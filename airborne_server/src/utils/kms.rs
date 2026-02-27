use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use aws_sdk_kms::Client;
use aws_sdk_s3::primitives::Blob;
use base64::{engine::general_purpose, Engine};
use serde::Deserialize;
use std::str;

/// Encrypted env data structure (using shared master key)
/// Format: { "nonce": "base64", "ciphertext": "base64" }
#[derive(Deserialize)]
struct EncryptedEnv {
    nonce: String,
    ciphertext: String,
}

/// Decrypt the master key using KMS (called once at startup)
pub async fn decrypt_master_key(
    kms_client: &Client,
    encrypted_master_key: &str,
) -> Result<Vec<u8>, String> {
    let encrypted_key = general_purpose::STANDARD
        .decode(encrypted_master_key)
        .map_err(|e| format!("Failed to decode master key: {}", e))?;

    let response = kms_client
        .decrypt()
        .ciphertext_blob(Blob::new(encrypted_key))
        .send()
        .await
        .map_err(|e| {
            format!(
                "Failed to decrypt master key via KMS: {} (debug: {:?})",
                e, e
            )
        })?;

    let master_key = response
        .plaintext
        .ok_or("No plaintext returned from KMS")?
        .into_inner();

    let master_key = if master_key.len() == 32 {
        master_key
    } else {
        let master_key_str = str::from_utf8(&master_key)
            .map_err(|e| format!("Master key plaintext is not valid UTF-8: {}", e))?;
        let trimmed = master_key_str.trim();
        hex::decode(trimmed).map_err(|e| {
            format!(
                "Failed to decode master key from hex: {} (raw_len={}, trimmed_len={})",
                e,
                master_key.len(),
                trimmed.len()
            )
        })?
    };

    if master_key.len() != 32 {
        return Err(format!(
            "Master key must be 32 bytes, got {}",
            master_key.len()
        ));
    }

    Ok(master_key)
}

/// Decrypt an env value using the master key using AES-GCM
pub fn decrypt_env(master_key: &[u8], encrypted_value: &str) -> Result<String, String> {
    let encrypted: EncryptedEnv = serde_json::from_str(encrypted_value).map_err(|e| {
        format!(
            "Failed to parse encrypted value as JSON for EncryptedEnv '{}': {}",
            encrypted_value, e
        )
    })?;

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

    let cipher = Aes256Gcm::new_from_slice(master_key)
        .map_err(|_| format!("Invalid AES-256-GCM key length: {}", master_key.len()))?;

    let nonce = Nonce::from_slice(&nonce_bytes);

    match cipher.decrypt(nonce, ciphertext.as_ref()) {
        Ok(plaintext_bytes) => {
            String::from_utf8(plaintext_bytes).map_err(|e| format!("UTF-8 decode error: {}", e))
        }
        Err(e) => Err(format!("Failed to decrypt encrypted env value: {}", e)),
    }
}
