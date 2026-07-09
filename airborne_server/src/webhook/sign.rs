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

use crate::types::{ABError, Result};
use aes_gcm::aead::{rand_core::RngCore, OsRng};
use hmac::{Hmac, Mac};
use sha2::Sha256;
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr, ToSocketAddrs};
use url::Url;

type HmacSha256 = Hmac<Sha256>;

/// Generate a new random webhook signing secret (64 hex chars = 32 bytes).
pub fn generate_secret() -> String {
    let mut bytes = [0u8; 32];
    OsRng.fill_bytes(&mut bytes);
    hex::encode(bytes)
}

/// Encrypt a webhook signing secret for at-rest storage using Airborne's **master
/// encryption key** (`MASTER_KEY`, base64 32-byte AES key — the same one used for env
/// secrets). When `key` is `None` (`USE_ENCRYPTED_SECRETS=false`, so there is no master
/// key), the secret is stored as-is, matching how env secrets behave in that mode.
pub async fn encrypt_secret(plaintext: &str, key: Option<&str>) -> Result<String> {
    match key {
        Some(k) => crate::utils::encryption::encrypt_string(plaintext, k).await,
        None => Ok(plaintext.to_string()),
    }
}

/// Decrypt an at-rest secret produced by [`encrypt_secret`].
pub async fn decrypt_secret(ciphertext: &str, key: Option<&str>) -> Result<String> {
    match key {
        Some(k) => crate::utils::encryption::decrypt_string(ciphertext, k).await,
        None => Ok(ciphertext.to_string()),
    }
}

/// Compute the `X-Airborne-Signature` value: hex(HMAC-SHA256(secret, "{ts}.{body}")).
pub fn sign_payload(secret: &str, timestamp: i64, body: &str) -> Result<String> {
    let mut mac = <HmacSha256 as Mac>::new_from_slice(secret.as_bytes())
        .map_err(|e| ABError::InternalServerError(format!("HMAC key error: {e}")))?;
    mac.update(format!("{timestamp}.").as_bytes());
    mac.update(body.as_bytes());
    Ok(hex::encode(mac.finalize().into_bytes()))
}

fn is_blocked_v4(ip: &Ipv4Addr) -> bool {
    ip.is_loopback()
        || ip.is_private()
        || ip.is_link_local()
        || ip.is_unspecified()
        || ip.is_broadcast()
        || ip.is_documentation()
        || ip.octets()[0] == 0
        // CGNAT 100.64.0.0/10
        || (ip.octets()[0] == 100 && (ip.octets()[1] & 0xc0) == 64)
}

fn is_blocked_v6(ip: &Ipv6Addr) -> bool {
    if ip.is_loopback() || ip.is_unspecified() {
        return true;
    }
    if let Some(v4) = ip.to_ipv4_mapped() {
        return is_blocked_v4(&v4);
    }
    let seg = ip.segments();
    // Unique-local fc00::/7 or link-local fe80::/10.
    (seg[0] & 0xfe00) == 0xfc00 || (seg[0] & 0xffc0) == 0xfe80
}

fn is_blocked_ip(ip: &IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => is_blocked_v4(v4),
        IpAddr::V6(v6) => is_blocked_v6(v6),
    }
}

/// SSRF guard for a user-supplied webhook URL. When `allow_insecure` is false
/// (production default), the host must resolve only to public addresses, blocking
/// loopback, private, link-local (incl. the cloud metadata IP), and CGNAT ranges.
///
/// Note: performs a blocking DNS lookup; call from a blocking context.
pub fn validate_url(raw: &str, allow_insecure: bool) -> Result<()> {
    let url =
        Url::parse(raw).map_err(|e| ABError::BadRequest(format!("Invalid webhook URL: {e}")))?;
    match url.scheme() {
        "http" | "https" => {}
        other => {
            return Err(ABError::BadRequest(format!(
                "Unsupported webhook URL scheme '{other}': only http and https are allowed"
            )))
        }
    }
    if allow_insecure {
        return Ok(());
    }
    let host = url
        .host_str()
        .ok_or_else(|| ABError::BadRequest("Webhook URL has no host".into()))?;
    let port = url.port_or_known_default().unwrap_or(443);
    let addrs = (host, port)
        .to_socket_addrs()
        .map_err(|e| ABError::BadRequest(format!("Cannot resolve webhook host '{host}': {e}")))?;
    let mut resolved = false;
    for addr in addrs {
        resolved = true;
        if is_blocked_ip(&addr.ip()) {
            return Err(ABError::BadRequest(format!(
                "Webhook URL resolves to a blocked private/loopback address ({})",
                addr.ip()
            )));
        }
    }
    if !resolved {
        return Err(ABError::BadRequest(format!(
            "Webhook host '{host}' did not resolve"
        )));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sign_is_stable_and_keyed() {
        let a = sign_payload("secret", 100, "{\"x\":1}").unwrap();
        let b = sign_payload("secret", 100, "{\"x\":1}").unwrap();
        let c = sign_payload("other", 100, "{\"x\":1}").unwrap();
        assert_eq!(a, b);
        assert_ne!(a, c);
        assert_eq!(a.len(), 64); // hex sha256
    }

    #[tokio::test]
    async fn unsigned_passthrough() {
        // No master key (USE_ENCRYPTED_SECRETS=false) => stored/read as-is.
        assert_eq!(
            encrypt_secret("topsecret", None).await.unwrap(),
            "topsecret"
        );
        assert_eq!(
            decrypt_secret("topsecret", None).await.unwrap(),
            "topsecret"
        );
    }

    #[test]
    fn ssrf_blocks_private_and_bad_schemes() {
        assert!(validate_url("http://169.254.169.254/latest/meta-data", false).is_err());
        assert!(validate_url("http://127.0.0.1/hook", false).is_err());
        assert!(validate_url("http://10.0.0.5/hook", false).is_err());
        assert!(validate_url("ftp://example.com/hook", false).is_err());
        // allow_insecure bypasses the resolution check (dev/local).
        assert!(validate_url("http://127.0.0.1/hook", true).is_ok());
    }
}
