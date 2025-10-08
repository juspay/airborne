use actix_web::error;
use aws_sdk_s3::{
    error::BoxError, operation::put_object::PutObjectOutput, primitives::ByteStream,
    types::ChecksumAlgorithm, Client,
};

pub async fn push_file_byte_arr(
    s3_client: &Client,
    bucket_name: String,
    byte_arr: Vec<u8>,
    filename: String,
) -> actix_web::Result<PutObjectOutput> {
    let byte_stream = ByteStream::from(byte_arr);

    s3_client
        .put_object()
        .bucket(bucket_name)
        .key(filename.clone())
        .body(byte_stream)
        .send()
        .await
        .map_err(error::ErrorInternalServerError)
}

pub async fn stream_file(
    s3_client: &Client,
    bucket_name: String,
    byte_stream: ByteStream,
    filename: String,
    file_size: i64,
    checksum: String,
) -> Result<PutObjectOutput, BoxError> {
    println!("Uploading file: {}", filename);
    println!("Uploading File: {}", file_size);
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
        .map_err(|e| e.into())
}
