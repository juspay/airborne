// Copyright 2025 Juspay Technologies
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

//! Guards for outbound HTTP fetches of caller-supplied URLs.
//!
//! The server downloads URLs that an authorised caller hands it — to size and
//! checksum a registered file, and to assemble build artefacts. Without
//! restrictions that turns the server into a proxy into its own network: the
//! caller picks the destination, and the server reaches it with the server's
//! network position, returning the size and checksum of whatever came back.
//!
//! The controls here are:
//!
//! - **Scheme allow-list.** Only `http` and `https`.
//! - **Address filtering**, covering loopback, private, link-local (including
//!   the cloud metadata address), carrier-grade NAT, and the other non-public
//!   ranges. This takes two forms, and both are needed:
//!   - In the resolver the HTTP client connects through, which covers names.
//!     Filtering there rather than in a pre-flight check leaves no window for a
//!     name to answer publicly during the check and privately at connect time.
//!   - As an explicit check on the URL, which covers addresses written
//!     literally. Hyper parses the host first and connects straight to an IP
//!     literal *without consulting the resolver at all*, so the resolver alone
//!     would not see `http://169.254.169.254/`.
//! - **Redirect cap**, with the scheme and address re-checked on each hop.
//! - **Response size cap**, enforced while streaming rather than by trusting
//!   `Content-Length`.
//! - **Connect and total timeouts.**
//!
//! Hosts the deployment must be able to reach — its own public endpoint, and
//! anything an operator names in `SSRF_ALLOWED_HOSTS` — are exempt from the
//! address filtering. The server fetches its own release config and its own
//! uploaded assets through the public endpoint, and in most deployments that
//! resolves to a private address.

use std::{
    collections::HashSet,
    net::{IpAddr, Ipv4Addr, Ipv6Addr, SocketAddr},
    sync::OnceLock,
    time::Duration,
};

use log::warn;
use reqwest::dns::{Addrs, Name, Resolve, Resolving};

use crate::types::ABError;

/// Maximum redirect hops followed for a caller-supplied URL.
const MAX_REDIRECTS: usize = 5;

/// Default ceiling on a downloaded body. The body is buffered in memory, so
/// this bounds allocation as much as it bounds the fetch.
const DEFAULT_MAX_DOWNLOAD_BYTES: u64 = 512 * 1024 * 1024;

const CONNECT_TIMEOUT: Duration = Duration::from_secs(10);
const TOTAL_TIMEOUT: Duration = Duration::from_secs(300);

static POLICY: OnceLock<OutboundPolicy> = OnceLock::new();

/// Which destinations this deployment may fetch from.
#[derive(Debug, Clone, Default)]
pub struct OutboundPolicy {
    /// Lower-cased host names exempt from address filtering.
    exempt_hosts: HashSet<String>,
    max_download_bytes: u64,
}

impl OutboundPolicy {
    /// Builds the policy from the deployment's public endpoint and the operator
    /// supplied allow-list.
    ///
    /// The public endpoint's host is always exempt: the server fetches its own
    /// release config and its own uploaded assets through that URL, and it
    /// commonly resolves to loopback or a private address.
    pub fn new(
        public_endpoint: &str,
        allowed_hosts_raw: Option<&str>,
        max_download_bytes: Option<u64>,
    ) -> Self {
        let mut exempt_hosts = HashSet::new();

        if let Some(host) = host_of(public_endpoint) {
            exempt_hosts.insert(host);
        } else if !public_endpoint.is_empty() {
            warn!(
                "Could not read a host out of PUBLIC_ENDPOINT ({:?}); the server \
                 may be unable to fetch its own assets if it resolves to a \
                 private address.",
                public_endpoint
            );
        }

        if let Some(raw) = allowed_hosts_raw {
            for entry in raw.split(',').map(str::trim).filter(|e| !e.is_empty()) {
                // Accept either a bare host or a full URL, so operators can
                // paste the same value they configured elsewhere.
                match host_of(entry) {
                    Some(host) => exempt_hosts.insert(host),
                    None => exempt_hosts.insert(entry.to_ascii_lowercase()),
                };
            }
        }

        Self {
            exempt_hosts,
            max_download_bytes: max_download_bytes.unwrap_or(DEFAULT_MAX_DOWNLOAD_BYTES),
        }
    }

    pub fn is_exempt(&self, host: &str) -> bool {
        self.exempt_hosts.contains(&host.to_ascii_lowercase())
    }

    pub fn max_download_bytes(&self) -> u64 {
        self.max_download_bytes
    }

    #[cfg(test)]
    pub fn exempt_hosts(&self) -> &HashSet<String> {
        &self.exempt_hosts
    }
}

/// Installs the process-wide outbound policy. Called once during startup.
pub fn init_policy(policy: OutboundPolicy) {
    if POLICY.set(policy).is_err() {
        warn!("Outbound fetch policy was already initialised; ignoring re-init.");
    }
}

/// The active policy.
///
/// Falls back to a policy with no exemptions if startup never installed one,
/// so a missed initialisation path fails closed rather than unguarded.
pub fn policy() -> &'static OutboundPolicy {
    POLICY.get_or_init(|| {
        warn!("Outbound fetch policy was not initialised; defaulting to no exempt hosts.");
        OutboundPolicy::default()
    })
}

/// Extracts a lower-cased host from a URL, or from a bare `host` / `host:port`.
fn host_of(value: &str) -> Option<String> {
    if let Ok(url) = url::Url::parse(value) {
        if let Some(host) = url.host_str() {
            // `host_str` keeps the brackets around an IPv6 literal; strip them
            // so a host compares equal however it was written.
            return Some(unbracket(host).to_ascii_lowercase());
        }
    }

    // Not a full URL — try it as an authority.
    let trimmed = value.trim();
    if trimmed.is_empty() || trimmed.contains('/') {
        return None;
    }

    let host = match trimmed.rsplit_once(':') {
        // Keep bare IPv6 literals intact; only strip what is really a port.
        Some((head, tail)) if !head.is_empty() && tail.chars().all(|c| c.is_ascii_digit()) => head,
        _ => trimmed,
    };

    Some(unbracket(host).to_ascii_lowercase())
}

/// Strips the brackets an IPv6 literal carries inside a URL authority.
fn unbracket(host: &str) -> &str {
    host.strip_prefix('[')
        .and_then(|rest| rest.strip_suffix(']'))
        .unwrap_or(host)
}

/// Whether an address is one this server may be pointed at.
///
/// Everything that is not globally routable is refused: those are the addresses
/// that only mean something from inside the deployment's network, which is
/// exactly the reach an attacker is trying to borrow.
pub fn is_public_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(ip) => is_public_ipv4(ip),
        IpAddr::V6(ip) => is_public_ipv6(ip),
    }
}

fn is_public_ipv4(ip: Ipv4Addr) -> bool {
    let [a, b, ..] = ip.octets();

    !(ip.is_loopback()
        || ip.is_private()
        || ip.is_link_local() // includes 169.254.169.254, the cloud metadata address
        || ip.is_broadcast()
        || ip.is_documentation()
        || ip.is_unspecified()
        || ip.is_multicast()
        // 100.64.0.0/10, carrier-grade NAT.
        || (a == 100 && (64..128).contains(&b))
        // 192.0.0.0/24, IETF protocol assignments.
        || ip.octets()[..3] == [192, 0, 0]
        // 198.18.0.0/15, benchmarking.
        || (a == 198 && (b == 18 || b == 19))
        // 240.0.0.0/4, reserved.
        || a >= 240)
}

fn is_public_ipv6(ip: Ipv6Addr) -> bool {
    let segments = ip.segments();

    // The native IPv6 ranges are checked first. `::1` and `::` also satisfy the
    // deprecated IPv4-compatible form, so delegating to the IPv4 rules before
    // this point would read them as 0.0.0.1 and 0.0.0.0 and let loopback pass.
    if ip.is_loopback()
        || ip.is_unspecified()
        || ip.is_multicast()
        // fc00::/7, unique local.
        || (segments[0] & 0xfe00) == 0xfc00
        // fe80::/10, link local.
        || (segments[0] & 0xffc0) == 0xfe80
        // 2001:db8::/32, documentation.
        || (segments[0] == 0x2001 && segments[1] == 0x0db8)
    {
        return false;
    }

    // An address embedding an IPv4 one is only as safe as that address:
    // ::ffff:127.0.0.1 must not be a way back to loopback.
    if let Some(mapped) = ip.to_ipv4_mapped() {
        return is_public_ipv4(mapped);
    }
    if let Some(compat) = ip.to_ipv4() {
        return is_public_ipv4(compat);
    }

    true
}

/// Rejects a URL whose scheme is not one we fetch over.
///
/// `file:`, `data:`, and friends are refused here; the address filtering below
/// only governs where a network connection may go.
pub fn check_scheme(url: &url::Url) -> Result<(), ABError> {
    match url.scheme() {
        "http" | "https" => Ok(()),
        other => Err(ABError::BadRequest(format!(
            "URL scheme {:?} is not allowed; only http and https are fetched",
            other
        ))),
    }
}

/// Rejects a URL that names a non-public address directly.
///
/// This is load-bearing and not redundant with the resolver: hyper parses the
/// host first and, when it is already an IP literal, connects straight to it
/// without consulting the resolver at all. `http://169.254.169.254/` — the
/// single most common SSRF payload — would otherwise never be filtered.
pub fn check_host(url: &url::Url) -> Result<(), ABError> {
    let Some(host) = url.host_str() else {
        return Err(ABError::BadRequest(format!(
            "URL {:?} has no host to connect to",
            url
        )));
    };

    let host = unbracket(host);

    if policy().is_exempt(host) {
        return Ok(());
    }

    if let Ok(ip) = host.parse::<IpAddr>() {
        if !is_public_ip(ip) {
            return Err(ABError::BadRequest(format!(
                "Refusing to fetch {}: {} is not a public address. Add the host \
                 to SSRF_ALLOWED_HOSTS if this deployment must reach it.",
                url, ip
            )));
        }
    }

    // A name is filtered by the guarded resolver at connect time instead, which
    // is what keeps the check and the connection from disagreeing.
    Ok(())
}

/// Validates a caller-supplied URL before it is fetched.
pub fn check_url(raw_url: &str) -> Result<url::Url, ABError> {
    let url = url::Url::parse(raw_url)
        .map_err(|e| ABError::BadRequest(format!("Invalid URL {:?}: {}", raw_url, e)))?;

    check_scheme(&url)?;
    check_host(&url)?;

    Ok(url)
}

/// A DNS resolver that hides non-public addresses from the HTTP client.
///
/// Filtering here rather than in a pre-flight check is what closes DNS
/// rebinding: the client can only connect to what this returns, so a name that
/// answers with a public address once and a private address a moment later
/// still cannot be connected to privately.
#[derive(Debug, Default)]
struct GuardedResolver;

impl Resolve for GuardedResolver {
    fn resolve(&self, name: Name) -> Resolving {
        let host = name.as_str().to_string();

        Box::pin(async move {
            if policy().is_exempt(&host) {
                let addrs = tokio::net::lookup_host((host.as_str(), 0))
                    .await?
                    .collect::<Vec<_>>();
                return Ok(Box::new(addrs.into_iter()) as Addrs);
            }

            let resolved: Vec<SocketAddr> =
                tokio::net::lookup_host((host.as_str(), 0)).await?.collect();

            if resolved.is_empty() {
                return Err(format!("No addresses found for host {:?}", host).into());
            }

            let (public, blocked): (Vec<_>, Vec<_>) = resolved
                .into_iter()
                .partition(|addr| is_public_ip(addr.ip()));

            if !blocked.is_empty() {
                warn!(
                    "Refusing non-public address(es) for host {:?}: {:?}",
                    host,
                    blocked.iter().map(|a| a.ip()).collect::<Vec<_>>()
                );
            }

            if public.is_empty() {
                return Err(format!(
                    "Host {:?} resolves only to non-public addresses; refusing to connect. \
                     Add it to SSRF_ALLOWED_HOSTS if this deployment must reach it.",
                    host
                )
                .into());
            }

            Ok(Box::new(public.into_iter()) as Addrs)
        })
    }
}

/// The shared client used for caller-supplied URLs.
///
/// Built once: it carries the guarded resolver, the redirect cap, and the
/// timeouts, so every fetch through it inherits them.
pub fn client() -> &'static reqwest::Client {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();

    CLIENT.get_or_init(|| {
        let redirect_policy = reqwest::redirect::Policy::custom(|attempt| {
            if attempt.previous().len() >= MAX_REDIRECTS {
                return attempt.error(format!("Exceeded {} redirects", MAX_REDIRECTS));
            }

            // Every hop is re-validated. Redirecting is the standard way to get
            // past a check that only looked at the URL the caller supplied, so
            // the scheme and any literal address are checked again here.
            if let Err(e) = check_scheme(attempt.url()) {
                return attempt.error(e.to_string());
            }
            if let Err(e) = check_host(attempt.url()) {
                return attempt.error(e.to_string());
            }

            attempt.follow()
        });

        reqwest::Client::builder()
            .dns_resolver(std::sync::Arc::new(GuardedResolver))
            .redirect(redirect_policy)
            .connect_timeout(CONNECT_TIMEOUT)
            .timeout(TOTAL_TIMEOUT)
            .build()
            .expect("failed to build the guarded outbound HTTP client")
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::str::FromStr;

    fn ip(value: &str) -> IpAddr {
        IpAddr::from_str(value).expect("valid ip")
    }

    /// Every one of these is a destination that only means something from
    /// inside the deployment's network. 169.254.169.254 in particular is the
    /// cloud metadata endpoint, which is the usual objective of an SSRF.
    #[test]
    fn non_public_addresses_are_refused() {
        for addr in [
            "127.0.0.1",
            "127.1.2.3",
            "0.0.0.0",
            "10.0.0.1",
            "172.16.0.1",
            "172.31.255.255",
            "192.168.1.1",
            "169.254.169.254",
            "169.254.1.1",
            "100.64.0.1",
            "100.127.255.255",
            "192.0.0.1",
            "198.18.0.1",
            "240.0.0.1",
            "255.255.255.255",
            "224.0.0.1",
            "::1",
            "::",
            "fc00::1",
            "fd00::1",
            "fe80::1",
            "2001:db8::1",
            "ff02::1",
        ] {
            assert!(!is_public_ip(ip(addr)), "{addr} must be refused");
        }
    }

    #[test]
    fn public_addresses_are_allowed() {
        for addr in [
            "8.8.8.8",
            "1.1.1.1",
            "93.184.216.34",
            "172.32.0.1",  // just outside 172.16/12
            "100.128.0.1", // just outside 100.64/10
            "99.255.255.255",
            "2606:4700:4700::1111",
            "2400:cb00::1",
        ] {
            assert!(is_public_ip(ip(addr)), "{addr} must be allowed");
        }
    }

    /// An IPv4 address wrapped in IPv6 notation is the same destination and
    /// must not become a way around the IPv4 rules.
    #[test]
    fn ipv4_addresses_embedded_in_ipv6_are_refused() {
        for addr in [
            "::ffff:127.0.0.1",
            "::ffff:10.0.0.1",
            "::ffff:169.254.169.254",
            "::ffff:192.168.0.1",
        ] {
            assert!(!is_public_ip(ip(addr)), "{addr} must be refused");
        }

        assert!(is_public_ip(ip("::ffff:8.8.8.8")));
    }

    #[test]
    fn only_http_and_https_are_fetched() {
        for raw in [
            "file:///etc/passwd",
            "data:text/plain;base64,UFdORUQ=",
            "gopher://127.0.0.1:70/1",
            "ftp://example.com/x",
        ] {
            let url = url::Url::parse(raw).expect("parses");
            assert!(check_scheme(&url).is_err(), "{raw} must be refused");
        }

        for raw in ["http://example.com/a.js", "https://example.com/a.js"] {
            let url = url::Url::parse(raw).expect("parses");
            assert!(check_scheme(&url).is_ok(), "{raw} must be allowed");
        }
    }

    #[test]
    fn urls_without_a_host_are_refused() {
        assert!(check_url("file:///etc/passwd").is_err());
        assert!(check_url("not a url").is_err());
        assert!(check_url("http://").is_err());
        assert!(check_url("https://example.com/bundle.js").is_ok());
    }

    /// hyper connects straight to an IP literal without consulting the
    /// resolver, so the guarded resolver alone does not cover these. Every one
    /// of these URLs has to be refused before the request is issued.
    #[test]
    fn urls_naming_a_non_public_address_directly_are_refused() {
        for raw in [
            "http://169.254.169.254/latest/meta-data/",
            "http://127.0.0.1:8081/api/admin",
            "http://localhost.localdomain/",
            "http://10.0.0.5/",
            "http://192.168.1.1/",
            "http://172.16.9.9/",
            "https://[::1]/",
            "http://[::ffff:127.0.0.1]/",
            "http://0.0.0.0/",
            "http://100.64.0.1/",
        ] {
            let refused = check_url(raw).is_err();
            // `localhost.localdomain` is a name, not a literal, so it is the
            // resolver's job rather than this check's.
            if raw.contains("localdomain") {
                continue;
            }
            assert!(refused, "{raw} must be refused before the request is sent");
        }
    }

    #[test]
    fn urls_naming_a_public_address_directly_are_allowed() {
        for raw in [
            "https://8.8.8.8/bundle.js",
            "http://93.184.216.34/a.js",
            "https://[2606:4700:4700::1111]/a.js",
            "https://cdn.example.com/a.js",
        ] {
            assert!(check_url(raw).is_ok(), "{raw} should be allowed");
        }
    }

    /// Decimal, octal, and hex spellings of an address are the same
    /// destination. Whatever `Url` normalises them to must still be refused.
    #[test]
    fn obfuscated_spellings_of_loopback_are_refused() {
        for raw in [
            "http://0177.0.0.1/", // octal
            "http://0x7f.0.0.1/", // hex
            "http://127.1/",      // short form
            "http://2130706433/", // decimal
        ] {
            match url::Url::parse(raw) {
                Ok(url) => {
                    if let Some(host) = url.host_str() {
                        // Whatever it normalised to, if it is an address at all
                        // it must not be a private one.
                        if let Ok(ip) = unbracket(host).parse::<IpAddr>() {
                            assert!(
                                !is_public_ip(ip),
                                "{raw} normalised to {ip}, which must be refused"
                            );
                            assert!(check_url(raw).is_err(), "{raw} must be refused");
                        }
                    }
                }
                Err(_) => { /* unparseable is refused anyway */ }
            }
        }
    }

    /// The server fetches its own release config and its own uploaded assets
    /// through the public endpoint, which usually resolves privately. If that
    /// host were not exempt, builds would break.
    #[test]
    fn the_public_endpoint_host_is_exempt() {
        let policy = OutboundPolicy::new("http://localhost:3000", None, None);

        assert!(policy.is_exempt("localhost"));
        assert!(!policy.is_exempt("evil.example.com"));
    }

    #[test]
    fn operators_can_exempt_additional_hosts() {
        let policy = OutboundPolicy::new(
            "https://airborne.example.com",
            Some("minio.internal, http://assets.internal:9000 ,STORAGE.INTERNAL"),
            None,
        );

        assert!(policy.is_exempt("airborne.example.com"));
        assert!(policy.is_exempt("minio.internal"));
        assert!(policy.is_exempt("assets.internal"));
        // Matching is case-insensitive in both directions.
        assert!(policy.is_exempt("storage.internal"));
        assert!(policy.is_exempt("Storage.Internal"));

        assert!(!policy.is_exempt("elsewhere.internal"));
    }

    /// An exemption must name one host, not open up everything.
    #[test]
    fn exemptions_do_not_leak_to_other_hosts() {
        let policy =
            OutboundPolicy::new("https://airborne.example.com", Some("minio.internal"), None);

        assert_eq!(policy.exempt_hosts().len(), 2);
        assert!(!policy.is_exempt("notminio.internal"));
        assert!(!policy.is_exempt("minio.internal.evil.com"));
        assert!(!policy.is_exempt("127.0.0.1"));
    }

    #[test]
    fn a_blank_allow_list_adds_nothing() {
        let policy = OutboundPolicy::new("https://airborne.example.com", Some("  , ,  "), None);

        assert_eq!(policy.exempt_hosts().len(), 1);
        assert!(policy.is_exempt("airborne.example.com"));
    }

    #[test]
    fn host_extraction_handles_urls_authorities_and_ipv6() {
        assert_eq!(host_of("https://Example.COM/x"), Some("example.com".into()));
        assert_eq!(host_of("example.com:8443"), Some("example.com".into()));
        assert_eq!(host_of("example.com"), Some("example.com".into()));
        assert_eq!(host_of("http://[::1]:8080/"), Some("::1".into()));
        assert_eq!(host_of("[::1]"), Some("::1".into()));
        assert_eq!(host_of(""), None);
    }

    #[test]
    fn the_download_cap_defaults_and_can_be_overridden() {
        let default = OutboundPolicy::new("https://a.example.com", None, None);
        assert_eq!(default.max_download_bytes(), DEFAULT_MAX_DOWNLOAD_BYTES);

        let custom = OutboundPolicy::new("https://a.example.com", None, Some(1024));
        assert_eq!(custom.max_download_bytes(), 1024);
    }
}
