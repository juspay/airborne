use base64::{engine::general_purpose, Engine as _};
use log::info;
use sha2::{Digest, Sha256 as checksum_algorithm};

use crate::types as airborne_types;
use crate::types::ABError;

pub async fn download_and_checksum(file_url: &str) -> airborne_types::Result<(u64, String)> {
    let bytes = download_and_calculate_filesize(file_url).await?;
    Ok((bytes.1, calculate_checksum(bytes.0).await))
}

pub async fn download_file_content(url: &str) -> airborne_types::Result<Vec<u8>> {
    let bytes = download_and_calculate_filesize(url).await?;
    Ok(bytes.0)
}

pub async fn download_and_calculate_filesize(url: &str) -> airborne_types::Result<(Vec<u8>, u64)> {
    info!("Downloading file from url, {:?}", url);
    let client = reqwest::Client::new();
    let response = client
        .get(url)
        .header("User-Agent", "Airborne-Rust/1.0")
        .send()
        .await
        .map_err(|e| {
            ABError::InternalServerError(format!("Failed to download file from {}: {}", url, e))
        })?
        .error_for_status()
        .map_err(|e| {
            ABError::InternalServerError(format!(
                "Received error status while downloading {}: {}",
                url, e
            ))
        })?;

    let bytes = response.bytes().await.map_err(|e| {
        ABError::InternalServerError(format!("Failed to read file content from {}: {}", url, e))
    })?;

    let file_size = bytes.len() as u64;

    Ok((bytes.to_vec(), file_size))
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
