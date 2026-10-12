use std::env;

use anyhow::Result;
use serde::{Deserialize, Serialize};

use crate::common::models::LoggingInfra;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub server: ServerConfig,
    pub kafka: KafkaConfig,
    pub clickhouse: ClickHouseConfig,
    pub logging_infrastructure: LoggingInfra, // "kafka-clickhouse" or "victoria-metrics" (default: "victoria-metrics")
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    pub port: u16,
    pub cors: CorsPolicy,
}

/// Which browser origins may call this service.
///
/// Deployments that terminate at a CDN or gateway usually let that edge own
/// CORS, in which case `AllowAny` here is deliberate. Self-hosted deployments
/// that expose the service directly need an allow-list, otherwise any site a
/// user visits can read analytics for any tenant from their browser.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum CorsPolicy {
    AllowAny,
    AllowList(Vec<String>),
}

impl CorsPolicy {
    /// Parses `CORS_ALLOWED_ORIGINS`.
    ///
    /// Unset, empty, or `*` selects `AllowAny`, preserving the historical
    /// behaviour so CDN-fronted deployments keep working untouched. Anything
    /// else is a comma-separated allow-list.
    pub fn from_env_value(raw: Option<&str>) -> Self {
        let Some(value) = raw.map(str::trim).filter(|value| !value.is_empty()) else {
            return CorsPolicy::AllowAny;
        };

        if value == "*" {
            return CorsPolicy::AllowAny;
        }

        let origins: Vec<String> = value
            .split(',')
            .map(str::trim)
            .filter(|origin| !origin.is_empty())
            .map(str::to_string)
            .collect();

        // A value consisting only of separators expresses no origins at all.
        // Treat it as unset rather than as "deny everything", so a stray comma
        // cannot silently break a deployment; the startup warning still fires.
        if origins.is_empty() {
            return CorsPolicy::AllowAny;
        }

        CorsPolicy::AllowList(origins)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KafkaConfig {
    pub brokers: String,
    pub topic: String,
    pub consumer_group: String,
    pub security_protocol: Option<String>,
    pub sasl_mechanisms: Option<String>,
    pub sasl_username: Option<String>,
    pub sasl_password: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClickHouseConfig {
    pub url: String,
    pub database: String,
    pub username: Option<String>,
    pub password: Option<String>,
}

impl Config {
    pub fn load() -> Result<Self> {
        dotenv::dotenv().ok();

        let config = Config {
            server: ServerConfig {
                port: env::var("SERVER_PORT").map_or(6400, |v| {
                    v.parse().expect("SERVER_PORT must be a valid number")
                }),
                cors: CorsPolicy::from_env_value(env::var("CORS_ALLOWED_ORIGINS").ok().as_deref()),
            },
            kafka: KafkaConfig {
                brokers: env::var("KAFKA_BROKERS").unwrap_or_else(|_| "localhost:9092".to_string()),
                topic: env::var("KAFKA_TOPIC").unwrap_or_else(|_| "ota-events".to_string()),
                consumer_group: env::var("KAFKA_CONSUMER_GROUP")
                    .unwrap_or_else(|_| "ota-analytics-consumer".to_string()),
                security_protocol: env::var("KAFKA_SECURITY_PROTOCOL").ok(),
                sasl_mechanisms: env::var("KAFKA_SASL_MECHANISMS").ok(),
                sasl_username: env::var("KAFKA_SASL_USERNAME").ok(),
                sasl_password: env::var("KAFKA_SASL_PASSWORD").ok(),
            },
            clickhouse: ClickHouseConfig {
                url: env::var("CLICKHOUSE_URL")
                    .unwrap_or_else(|_| "http://localhost:8123".to_string()),
                database: env::var("CLICKHOUSE_DATABASE")
                    .unwrap_or_else(|_| "analytics".to_string()),
                username: env::var("CLICKHOUSE_USERNAME").ok(),
                password: env::var("CLICKHOUSE_PASSWORD").ok(),
            },
            logging_infrastructure: env::var("LOGGING_INFRASTRUCTURE")
                .map_or(Ok(LoggingInfra::VictoriaMetrics), |v| {
                    v.parse::<LoggingInfra>()
                })
                .map_err(anyhow::Error::msg)?,
        };

        Ok(config)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Deployments that front this service with a CDN rely on the historical
    /// permissive behaviour, so an absent variable must not start restricting.
    #[test]
    fn unset_or_blank_allows_any_origin() {
        assert_eq!(CorsPolicy::from_env_value(None), CorsPolicy::AllowAny);
        assert_eq!(CorsPolicy::from_env_value(Some("")), CorsPolicy::AllowAny);
        assert_eq!(
            CorsPolicy::from_env_value(Some("   ")),
            CorsPolicy::AllowAny
        );
    }

    #[test]
    fn wildcard_allows_any_origin() {
        assert_eq!(CorsPolicy::from_env_value(Some("*")), CorsPolicy::AllowAny);
        assert_eq!(
            CorsPolicy::from_env_value(Some("  *  ")),
            CorsPolicy::AllowAny
        );
    }

    #[test]
    fn single_origin_is_allow_listed() {
        assert_eq!(
            CorsPolicy::from_env_value(Some("https://airborne.example.com")),
            CorsPolicy::AllowList(vec!["https://airborne.example.com".to_string()])
        );
    }

    #[test]
    fn comma_separated_origins_are_split_and_trimmed() {
        assert_eq!(
            CorsPolicy::from_env_value(Some(
                " https://a.example.com , https://b.example.com:8443 "
            )),
            CorsPolicy::AllowList(vec![
                "https://a.example.com".to_string(),
                "https://b.example.com:8443".to_string(),
            ])
        );
    }

    /// A value of only separators names no origins. Falling back to the
    /// documented default beats inventing a deny-everything policy from what
    /// is almost certainly a typo — the startup warning still surfaces it.
    #[test]
    fn separator_only_value_falls_back_to_any() {
        assert_eq!(CorsPolicy::from_env_value(Some(",")), CorsPolicy::AllowAny);
        assert_eq!(
            CorsPolicy::from_env_value(Some(" , , ")),
            CorsPolicy::AllowAny
        );
    }

    /// An allow-list must never silently collapse into "any origin".
    #[test]
    fn allow_list_never_degrades_to_allow_any() {
        for raw in [
            "https://a.example.com",
            "https://a.example.com,https://b.example.com",
            "http://localhost:3000",
        ] {
            assert!(
                matches!(
                    CorsPolicy::from_env_value(Some(raw)),
                    CorsPolicy::AllowList(_)
                ),
                "{raw:?} should produce an allow-list"
            );
        }
    }
}
