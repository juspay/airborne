use anyhow::Result;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Clone)]
pub struct VictoriaMetricsQueryClient {
    pub client: Client,
    pub base_url: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct QueryResponse {
    pub status: String,
    pub data: QueryData,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct QueryData {
    #[serde(rename = "resultType")]
    pub result_type: String,
    pub result: Vec<QueryResult>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct QueryResult {
    pub metric: HashMap<String, String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub value: Option<(f64, String)>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub values: Option<Vec<(f64, String)>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RangeQueryResponse {
    pub status: String,
    pub data: QueryData,
}

impl VictoriaMetricsQueryClient {
    pub fn new(base_url: String) -> Self {
        Self {
            client: Client::new(),
            base_url,
        }
    }

    pub async fn query(&self, query: &str) -> Result<QueryResponse> {
        let url = format!("{}/api/v1/query", self.base_url);
        let response = self
            .client
            .get(&url)
            .query(&[("query", query)])
            .send()
            .await?;

        let query_response: QueryResponse = response.json().await?;
        Ok(query_response)
    }

    pub async fn query_range(
        &self,
        query: &str,
        start: i64,
        end: i64,
        step: &str,
    ) -> Result<RangeQueryResponse> {
        let url = format!("{}/api/v1/query_range", self.base_url);
        let response = self
            .client
            .get(&url)
            .query(&[
                ("query", query),
                ("start", &start.to_string()),
                ("end", &end.to_string()),
                ("step", step),
            ])
            .send()
            .await?;

        let range_response: RangeQueryResponse = response.json().await?;
        Ok(range_response)
    }
}
