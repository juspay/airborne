use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Key, Nonce,
};
use base64::{engine::general_purpose, Engine as _};
use rand::RngCore;

pub fn generate_random_key() -> String {
    let mut key_bytes = [0u8; 32];
    OsRng.fill_bytes(&mut key_bytes);
    general_purpose::STANDARD.encode(key_bytes)
}

pub fn encrypt_string(plaintext: &str, key_b64: &str) -> Result<String, String> {
    // Decode the base64 key
    let key_bytes = general_purpose::STANDARD
        .decode(key_b64)
        .map_err(|e| format!("Base64 decode error: {}", e))?;
    if key_bytes.len() != 32 {
        return Err("Invalid key length. Expected 32 bytes.".to_string());
    }

    let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
    let cipher = Aes256Gcm::new(key);

    // Generate a random nonce (12 bytes for GCM)
    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    // Encrypt the plaintext
    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_bytes())
        .map_err(|e| format!("Encryption failed: {}", e))?;

    // Combine nonce + ciphertext for storage
    let mut result = Vec::new();
    result.extend_from_slice(&nonce_bytes);
    result.extend_from_slice(&ciphertext);

    // Return as base64 string
    Ok(general_purpose::STANDARD.encode(result))
}
pub fn decrypt_string(encrypted_b64: &str, key_b64: &str) -> Result<String, String> {
    // Decode the base64 key
    let key_bytes = general_purpose::STANDARD
        .decode(key_b64)
        .map_err(|e| format!("Base64 decode error: {}", e))?;
    if key_bytes.len() != 32 {
        return Err("Invalid key length. Expected 32 bytes.".to_string());
    }

    // Decode the encrypted data
    let encrypted_data = general_purpose::STANDARD
        .decode(encrypted_b64)
        .map_err(|e| format!("Base64 decode error: {}", e))?;
    if encrypted_data.len() < 12 {
        return Err("Invalid encrypted data length.".to_string());
    }

    let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
    let cipher = Aes256Gcm::new(key);

    // Extract nonce (first 12 bytes) and ciphertext (remaining bytes)
    let (nonce_bytes, ciphertext) = encrypted_data.split_at(12);
    let nonce = Nonce::from_slice(nonce_bytes);

    // Decrypt the ciphertext
    let plaintext_bytes = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| format!("Decryption failed: {}", e))?;

    // Convert bytes back to string
    let plaintext =
        String::from_utf8(plaintext_bytes).map_err(|e| format!("UTF-8 decode error: {}", e))?;
    Ok(plaintext)
}
