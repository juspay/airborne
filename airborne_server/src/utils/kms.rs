use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Key, Nonce,
};
use aws_sdk_kms::Client;
use aws_sdk_s3::primitives::Blob;
use base64::{engine::general_purpose, Engine};
use serde::Deserialize;

/// Encrypted env data structure (using shared master key)
/// Format: { "nonce": "base64", "ciphertext": "base64" }
#[derive(Deserialize)]
struct EncryptedEnv {
    nonce: String,
    ciphertext: String,
}

/// Decrypt the master key using KMS (called once at startup)
/// Returns the decrypted master key as a hex-encoded string
pub async fn decrypt_master_key(
    kms_client: &Client,
    encrypted_master_key: &str,
) -> Result<String, String> {
    let encrypted_key = general_purpose::STANDARD
        .decode(encrypted_master_key)
        .map_err(|e| format!("Failed to decode master key: {}", e))?;

    let response = kms_client
        .decrypt()
        .ciphertext_blob(Blob::new(encrypted_key))
        .send()
        .await
        .map_err(|e| format!("Failed to decrypt master key via KMS: {}", e))?;

    let master_key = response
        .plaintext
        .ok_or("No plaintext returned from KMS")?
        .into_inner();

    // Convert to hex string for consistent handling
    Ok(hex::encode(master_key))
}

/// Decrypt an env value using the master key using AES-GCM
pub fn decrypt_env(master_key: &[u8], encrypted_value: &str) -> Result<String, String> {
    let encrypted: EncryptedEnv = serde_json::from_str(encrypted_value)
        .map_err(|e| format!("Failed to parse encrypted value as JSON: {}", e))?;

    let nonce_bytes = general_purpose::STANDARD
        .decode(&encrypted.nonce)
        .map_err(|e| format!("Failed to decode nonce: {}", e))?;

    if nonce_bytes.len() != 12 {
        return Err(format!(
            "Invalid nonce length: expected 12, got {}",
            nonce_bytes.len()
        ));
    }

    let ciphertext = general_purpose::STANDARD
        .decode(&encrypted.ciphertext)
        .map_err(|e| format!("Failed to decode ciphertext: {}", e))?;

    let key = Key::<Aes256Gcm>::from_slice(master_key);
    let cipher = Aes256Gcm::new(key);

    let nonce = Nonce::from_slice(&nonce_bytes);

    let plaintext_bytes = cipher
        .decrypt(nonce, ciphertext.as_ref())
        .map_err(|e| format!("Failed to decrypt value: {}", e))?;

    String::from_utf8(plaintext_bytes).map_err(|e| format!("UTF-8 decode error: {}", e))
}
