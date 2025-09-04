use sha2::{Sha256 as checksum_algorithm, Digest};
use futures_util::StreamExt;

pub async fn download_and_checksum(file_url: &str) -> Result<(u64, String), Box<dyn std::error::Error>> {
    let client = reqwest::Client::new();
    let resp = client.get(file_url).send().await?;
    let mut stream = resp.bytes_stream();

    let mut hasher = checksum_algorithm::new();
    let mut total_bytes = 0u64;

    while let Some(chunk) = stream.next().await {
        let chunk = chunk?;
        total_bytes += chunk.len() as u64;
        hasher.update(&chunk);
    }

    let file_checksum = hasher.finalize();
    Ok((total_bytes, hex::encode(file_checksum)))
}

pub async fn calculate_checksum(byte_arr: Vec<u8>) -> String {
    let mut hasher = checksum_algorithm::new();
    hasher.update(byte_arr);
    hex::encode(hasher.finalize())
}

pub fn create_s3_file_url(
    bucket_name: &str,
    s3_path: &str,
) -> String {
    format!(
        "{}/{}/{}",
        "http://localhost:7566", bucket_name, s3_path
    )
}

pub fn create_s3_file_path(
    org_id: &str,
    app_id: &str,
    file_id: &str,
    version: &str,
    file_name: &str,
) -> String {
    format!(
        "{}/{}/{}/{}/{}",
        org_id, app_id, file_id, version, file_name
    )
}

pub fn parse_file_key(spec: &str) -> (String, Option<i32>, Option<String>) {
    if let Some(at_idx) = spec.rfind('@') {
        let (path, suffix_with_at) = spec.split_at(at_idx);
        let suffix = &suffix_with_at[1..];
        match suffix.splitn(2, ':').collect::<Vec<_>>().as_slice() {
            ["version", ver] => (path.to_string(), ver.parse().ok(), None),
            ["tag", tag]     => (path.to_string(), None, Some(tag.to_string())),
            _                       => (spec.to_string(), None, None),
        }
    } else {
        (spec.to_string(), None, None)
    }
}