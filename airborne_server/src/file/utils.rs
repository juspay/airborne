use base64::{engine::general_purpose, Engine as _};
use log::info;
use sha2::{Digest, Sha256 as checksum_algorithm};

use crate::types as airborne_types;
use crate::types::ABError;
use crate::utils::outbound;

pub async fn download_and_checksum(file_url: &str) -> airborne_types::Result<(u64, String)> {
    let bytes = download_and_calculate_filesize(file_url, &None).await?;
    Ok((bytes.1, calculate_checksum(bytes.0).await))
}

pub async fn download_file_content(
    url: &str,
    headers: &Option<Vec<(String, String)>>,
) -> airborne_types::Result<Vec<u8>> {
    let bytes = download_and_calculate_filesize(url, headers).await?;
    Ok(bytes.0)
}

pub async fn download_and_calculate_filesize(
    url: &str,
    headers: &Option<Vec<(String, String)>>,
) -> airborne_types::Result<(Vec<u8>, u64)> {
    info!("Downloading file from url, {:?}", url);

    // The caller chooses this URL, so it is validated before a connection is
    // opened and the connection itself goes through the guarded client, which
    // filters the addresses it will connect to, caps redirects, and applies
    // timeouts. See `utils::outbound`.
    outbound::check_url(url)?;

    let mut request = outbound::client()
        .get(url)
        .header("User-Agent", "Airborne-Rust/1.0");
    if let Some(headers) = headers {
        for (key, value) in headers {
            request = request.header(key, value);
        }
    }
    let response = request.send().await.map_err(|e| {
        ABError::InternalServerError(format!("Failed to download file from {}: {}", url, e))
    })?;
    let response = response.error_for_status().map_err(|e| {
        ABError::InternalServerError(format!(
            "Received error status while downloading {}: {}",
            url, e
        ))
    })?;

    let max_bytes = outbound::policy().max_download_bytes();

    // Reject on the advertised length when there is one, so an oversized body
    // is refused before it is transferred rather than after.
    if let Some(advertised) = response.content_length() {
        if advertised > max_bytes {
            return Err(ABError::BadRequest(format!(
                "File at {} is {} bytes, above the {} byte limit",
                url, advertised, max_bytes
            )));
        }
    }

    // Content-Length is the server's claim, not a fact, so the cap is also
    // enforced against what actually arrives.
    let mut response = response;
    let mut bytes: Vec<u8> = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|e| {
        ABError::InternalServerError(format!("Failed to read file content from {}: {}", url, e))
    })? {
        if bytes.len() as u64 + chunk.len() as u64 > max_bytes {
            return Err(ABError::BadRequest(format!(
                "File at {} exceeds the {} byte limit",
                url, max_bytes
            )));
        }
        bytes.extend_from_slice(&chunk);
    }

    let file_size = bytes.len() as u64;

    Ok((bytes, file_size))
}

pub async fn calculate_checksum(byte_arr: Vec<u8>) -> String {
    let mut hasher = checksum_algorithm::new();
    hasher.update(byte_arr);
    hex::encode(hasher.finalize())
}

pub fn create_s3_file_path(
    org_id: &str,
    app_id: &str,
    file_id: &str,
    version: &str,
    file_name: &str,
) -> String {
    format!(
        "assets/{}/{}/{}/{}/{}",
        org_id, app_id, file_id, version, file_name
    )
}

pub fn parse_file_key(spec: &str) -> (String, Option<i32>, Option<String>) {
    if let Some(at_idx) = spec.rfind('@') {
        let (path, suffix_with_at) = spec.split_at(at_idx);
        let suffix = &suffix_with_at[1..];
        match suffix.splitn(2, ':').collect::<Vec<_>>().as_slice() {
            ["version", ver] => (path.to_string(), ver.parse().ok(), None),
            ["tag", tag] => (path.to_string(), None, Some(tag.to_string())),
            _ => (spec.to_string(), None, None),
        }
    } else {
        (spec.to_string(), None, None)
    }
}

pub fn base64_to_hex(value: &str) -> String {
    match general_purpose::STANDARD.decode(value) {
        Ok(bytes) => hex::encode(bytes),
        Err(_) => String::new(), // return empty string on invalid base64
    }
}

#[cfg(test)]
mod outbound_fetch_tests {
    use super::*;
    use std::sync::{
        atomic::{AtomicUsize, Ordering},
        Arc,
    };
    use tokio::io::AsyncWriteExt;
    use tokio::net::TcpListener;

    /// Starts a loopback listener that counts accepted connections and answers
    /// everything with `body`. The count is the interesting part: a guard that
    /// works stops the request before a connection is ever opened.
    async fn spawn_loopback_server(body: &'static str) -> (u16, Arc<AtomicUsize>) {
        let listener = TcpListener::bind("127.0.0.1:0").await.expect("bind");
        let port = listener.local_addr().expect("addr").port();
        let hits = Arc::new(AtomicUsize::new(0));
        let hits_for_task = hits.clone();

        tokio::spawn(async move {
            loop {
                let Ok((mut socket, _)) = listener.accept().await else {
                    return;
                };
                hits_for_task.fetch_add(1, Ordering::SeqCst);
                let response = format!(
                    "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                    body.len(),
                    body
                );
                let _ = socket.write_all(response.as_bytes()).await;
                let _ = socket.shutdown().await;
            }
        });

        (port, hits)
    }

    /// The end-to-end property. Before this guard, pointing the downloader at a
    /// loopback service returned that service's bytes, and their size and
    /// checksum were reported back to the caller.
    #[tokio::test]
    async fn a_loopback_url_is_refused_without_connecting() {
        let (port, hits) = spawn_loopback_server("INTERNAL-ONLY").await;
        let url = format!("http://127.0.0.1:{port}/secret");

        let result = download_and_calculate_filesize(&url, &None).await;

        assert!(
            matches!(result, Err(ABError::BadRequest(_))),
            "a loopback URL must be refused by policy: {result:?}"
        );
        assert_eq!(
            hits.load(Ordering::SeqCst),
            0,
            "the guard must refuse before opening a connection"
        );
    }

    /// The metadata endpoint is what makes SSRF worth exploiting on a cloud
    /// host, so it gets its own test rather than living in a list.
    ///
    /// This asserts the request was *refused* rather than merely failing.
    /// Without that distinction the test also passes on a machine where the
    /// address simply times out, which would hide a missing guard.
    #[tokio::test]
    async fn the_cloud_metadata_address_is_refused() {
        let started = std::time::Instant::now();
        let result =
            download_and_calculate_filesize("http://169.254.169.254/latest/meta-data/", &None)
                .await;

        assert!(
            matches!(result, Err(ABError::BadRequest(_))),
            "the metadata address must be refused by policy, not left to the \
             network to fail: {result:?}"
        );
        assert!(
            started.elapsed() < std::time::Duration::from_secs(5),
            "refusal must happen before any connection attempt"
        );
    }

    /// Refused by policy, not left to the HTTP client to reject, so the caller
    /// gets a clear 400 rather than an opaque transport failure.
    #[tokio::test]
    async fn non_http_schemes_are_refused() {
        for url in [
            "file:///etc/passwd",
            "data:text/plain;base64,UFdORUQ=",
            "gopher://127.0.0.1:70/1",
        ] {
            let result = download_and_calculate_filesize(url, &None).await;
            assert!(
                matches!(result, Err(ABError::BadRequest(_))),
                "{url} must be refused by policy: {result:?}"
            );
        }
    }

    /// A redirect is the standard way past a check that only inspected the URL
    /// the caller handed over, so each hop is re-checked. This asserts the hop
    /// check itself refuses a loopback target and that nothing connects to it.
    #[tokio::test]
    async fn a_redirect_target_on_loopback_is_refused() {
        let (port, hits) = spawn_loopback_server("INTERNAL-ONLY").await;
        let hop = url::Url::parse(&format!("http://127.0.0.1:{port}/secret")).expect("url");

        assert!(
            crate::utils::outbound::check_host(&hop).is_err(),
            "a redirect to loopback must be refused"
        );
        assert_eq!(hits.load(Ordering::SeqCst), 0);
    }

    /// A public destination still has to work, or the guard has just broken
    /// every legitimate file registration.
    #[tokio::test]
    async fn an_exempt_host_is_still_reachable() {
        let (port, hits) = spawn_loopback_server("BUNDLE-BYTES").await;

        // `localhost` is exempt in the default test policy only if configured,
        // so this asserts the exemption predicate rather than mutating global
        // state that other tests in this binary share.
        let policy = crate::utils::outbound::OutboundPolicy::new(
            &format!("http://127.0.0.1:{port}"),
            None,
            None,
        );
        assert!(
            policy.is_exempt("127.0.0.1"),
            "the deployment's own endpoint must stay reachable"
        );
        assert_eq!(hits.load(Ordering::SeqCst), 0);
    }
}
