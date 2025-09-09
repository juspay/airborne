use actix_multipart::form::tempfile::TempFile;
use aws_sdk_s3::{operation::put_object::PutObjectOutput, primitives::ByteStream, Client};

use crate::types::{ABError, ABResult};

pub async fn push_file(
    s3_client: &Client,
    bucket_name: String,
    file: TempFile,
    filename: String,
) -> ABResult<PutObjectOutput> {
    // Convert file into S3 ByteStream
    let file_data = tokio::fs::read(file.file.path()).await?;
    let byte_stream = ByteStream::from(file_data);

    s3_client
        .put_object()
        .bucket(bucket_name)
        .key(filename.clone())
        .body(byte_stream)
        .send()
        .await
        .map_err(|e| ABError::InternalServerError(e.to_string()))
}
