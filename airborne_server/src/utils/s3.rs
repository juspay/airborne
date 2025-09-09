use aws_sdk_s3::{
    operation::put_object::PutObjectOutput, primitives::ByteStream, types::ChecksumAlgorithm,
    Client,
};
use log::info;

use crate::types as airborne_types;
use crate::types::ABError;

pub async fn push_file_byte_arr(
    s3_client: &Client,
    bucket_name: String,
    byte_arr: Vec<u8>,
    filename: String,
) -> airborne_types::Result<PutObjectOutput> {
    let byte_stream = ByteStream::from(byte_arr);

    s3_client
        .put_object()
        .bucket(bucket_name)
        .key(filename.clone())
        .body(byte_stream)
        .send()
        .await
        .map_err(|e| ABError::InternalServerError(e.to_string()))
}

pub async fn stream_file(
    s3_client: &Client,
    bucket_name: String,
    byte_stream: ByteStream,
    filename: String,
    file_size: i64,
    checksum: String,
) -> airborne_types::Result<PutObjectOutput> {
    info!("Uploading file: {}", filename);
    info!("Uploading File: {}", file_size);
    s3_client
        .put_object()
        .bucket(bucket_name)
        .key(filename.clone())
        .content_length(file_size)
        .set_checksum_sha256(Some(checksum))
        .set_checksum_algorithm(Some(ChecksumAlgorithm::Sha256))
        .body(byte_stream)
        .send()
        .await
        .map_err(|e| ABError::InternalServerError(e.to_string()))
}
