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

use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use diesel::prelude::*;
use log::{error, info, warn};
use p256::{
    ecdsa::{signature::Signer, Signature, SigningKey},
    elliptic_curve::rand_core::OsRng,
    pkcs8::{DecodePrivateKey, EncodePrivateKey, EncodePublicKey, LineEnding},
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    run_blocking,
    types::{ABError, AppState},
    utils::advisory_lock::{try_acquire_lock, LockNamespace},
    utils::db::{
        models::{NewSigningKey, SigningKeyEntry},
        schema::hyperotaserver::{
            signing_keys::{
                app_id as sk_app_id, disabled as sk_disabled, is_default as sk_is_default,
                name as sk_name, org_id as sk_org_id, table as signing_keys_table,
                updated_at as sk_updated_at,
            },
            workspace_names::{
                application_id as wn_app_id, organization_id as wn_org_id,
                table as workspace_names_table,
            },
        },
        DbPool,
    },
    utils::moka::{MokaCache, MokaKey},
    utils::redis::{RedisCache, RedisKey},
};

/// The only algorithm we sign with today. Persisted per row so another one can
/// be introduced later without a migration.
pub const ALGORITHM: &str = "ecdsa-p256";

/// Value carried in the `alg` field of the `X-Airborne-Signature` header.
pub const ALGORITHM_LABEL: &str = "es256";

/// Key ID given to the keypair provisioned automatically for every application.
pub const DEFAULT_KEY_ID: &str = "default";

pub const SIGNING_KEY_ID_MAX_LENGTH: usize = 50;

/// Request header a caller can send to pick a specific signing key. When absent,
/// the application's default key is used.
pub const SIGNING_KEY_ID_HEADER: &str = "x-signing-key-id";

/// Response header carrying the signature over the release-config body.
pub const SIGNATURE_HEADER: &str = "x-airborne-signature";

/// Backstop TTL for the cached signing key. Mutations invalidate explicitly, so
/// this only bounds staleness if an invalidation is lost.
const KEY_CACHE_TTL_SECS: usize = 5 * 60;

/// A signing key as needed by the serve path.
#[derive(Serialize, Deserialize, Clone)]
pub struct ActiveSigningKey {
    pub key_id: String,
    pub algorithm: String,
    pub private_key_encrypted: String,
}

impl From<SigningKeyEntry> for ActiveSigningKey {
    fn from(entry: SigningKeyEntry) -> Self {
        Self {
            key_id: entry.name,
            algorithm: entry.algorithm,
            private_key_encrypted: entry.private_key_encrypted,
        }
    }
}

/// Normalize an `X-Signing-Key-Id` header value into an explicit key request.
pub fn requested_key_id(header_value: Option<&str>) -> Option<&str> {
    header_value
        .map(str::trim)
        .filter(|value| !value.is_empty())
}

/// Validate the immutable, client-visible signing key ID.
pub fn validate_key_id(key_id: &str) -> Result<String, ABError> {
    if key_id.is_empty() {
        return Err(ABError::BadRequest(
            "Signing key ID is required".to_string(),
        ));
    }

    if key_id.len() > SIGNING_KEY_ID_MAX_LENGTH {
        return Err(ABError::BadRequest(format!(
            "Signing key ID must be at most {SIGNING_KEY_ID_MAX_LENGTH} characters"
        )));
    }

    let valid_characters = key_id
        .bytes()
        .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-');
    let valid_dashes = !key_id.starts_with('-') && !key_id.ends_with('-') && !key_id.contains("--");

    if !valid_characters || !valid_dashes {
        return Err(ABError::BadRequest(
            "Signing key ID may only contain lowercase letters (a-z), digits (0-9), and dashes; dashes cannot be consecutive or appear at the start or end"
                .to_string(),
        ));
    }

    Ok(key_id.to_string())
}

pub struct GeneratedKeypair {
    /// PKCS#8 PEM.
    pub private_key: String,
    /// SPKI PEM — this is what managers download and verify against.
    pub public_key: String,
}

/// Generate a fresh ECDSA P-256 keypair.
pub fn generate_keypair() -> Result<GeneratedKeypair, ABError> {
    let signing_key = SigningKey::random(&mut OsRng);

    let private_key = signing_key
        .to_pkcs8_pem(LineEnding::LF)
        .map_err(|e| ABError::InternalServerError(format!("Failed to encode private key: {e}")))?
        .to_string();

    let public_key = signing_key
        .verifying_key()
        .to_public_key_pem(LineEnding::LF)
        .map_err(|e| ABError::InternalServerError(format!("Failed to encode public key: {e}")))?;

    Ok(GeneratedKeypair {
        private_key,
        public_key,
    })
}

/// Encrypt a private key for at-rest storage with the same master key used for
/// encrypted environment secrets.
async fn encrypt_private_key(plaintext: &str, key: Option<&str>) -> Result<String, ABError> {
    match key {
        Some(key) => crate::utils::encryption::encrypt_string(plaintext, key).await,
        None => Ok(plaintext.to_string()),
    }
}

/// Decrypt a private key produced by [`encrypt_private_key`].
async fn decrypt_private_key(ciphertext: &str, key: Option<&str>) -> Result<String, ABError> {
    match key {
        Some(key) => crate::utils::encryption::decrypt_string(ciphertext, key).await,
        None => Ok(ciphertext.to_string()),
    }
}

/// Sign `payload` with ES256 (ECDSA P-256 over SHA-256) and return the
/// base64 of the DER-encoded signature.
pub fn sign_payload(private_key_pem: &str, payload: &[u8]) -> Result<String, ABError> {
    let key = SigningKey::from_pkcs8_pem(private_key_pem)
        .map_err(|e| ABError::InternalServerError(format!("Malformed signing key: {e}")))?;
    let signature: Signature = key.sign(payload);
    Ok(BASE64.encode(signature.to_der().as_bytes()))
}

/// Render the `X-Airborne-Signature` header value.
pub fn signature_header_value(key_id: &str, signature_b64: &str) -> String {
    format!(r#"keyid="{key_id}",alg="{ALGORITHM_LABEL}",sig="{signature_b64}""#)
}

// ---------------------------------------------------------------------------
// Cached lookups used by the public serve path
// ---------------------------------------------------------------------------

async fn fetch_default_key_db(
    pool: DbPool,
    organisation: String,
    application: String,
) -> Result<Option<ActiveSigningKey>, ABError> {
    run_blocking!({
        let mut conn = pool.get()?;
        let entry = signing_keys_table
            .filter(sk_org_id.eq(&organisation))
            .filter(sk_app_id.eq(&application))
            .filter(sk_is_default.eq(true))
            .filter(sk_disabled.eq(false))
            .select(SigningKeyEntry::as_select())
            .first::<SigningKeyEntry>(&mut conn)
            .optional()?;
        Ok(entry.map(Into::into))
    })
}

async fn fetch_key_by_id_db(
    pool: DbPool,
    organisation: String,
    application: String,
    key_id: String,
) -> Result<Option<ActiveSigningKey>, ABError> {
    run_blocking!({
        let mut conn = pool.get()?;
        let entry = signing_keys_table
            .filter(sk_name.eq(&key_id))
            .filter(sk_org_id.eq(&organisation))
            .filter(sk_app_id.eq(&application))
            .filter(sk_disabled.eq(false))
            .select(SigningKeyEntry::as_select())
            .first::<SigningKeyEntry>(&mut conn)
            .optional()?;
        Ok(entry.map(Into::into))
    })
}

/// Resolve the key to sign a release config with.
pub async fn resolve_signing_key(
    state: &AppState,
    organisation: &str,
    application: &str,
    requested_key_id: Option<&str>,
) -> Result<Option<ActiveSigningKey>, ABError> {
    let pool = state.db_pool.clone();

    let Some(raw_key_id) = requested_key_id else {
        let Some(cache) = &state.redis_cache else {
            return fetch_default_key_db(pool, organisation.to_owned(), application.to_owned())
                .await;
        };
        let cache_key = cache.key(
            organisation,
            application,
            &["signing_key", "implicit_default"],
        );
        let (org, app) = (organisation.to_owned(), application.to_owned());
        return cache
            .get_or_try_set::<Option<ActiveSigningKey>, _, _>(
                &cache_key,
                KEY_CACHE_TTL_SECS,
                || async { fetch_default_key_db(pool, org, app).await },
            )
            .await;
    };

    let key_id = validate_key_id(raw_key_id).map_err(|_| {
        ABError::BadRequest("Unknown or disabled signing key in X-Signing-Key-Id".to_string())
    })?;

    let key = match &state.redis_cache {
        None => {
            fetch_key_by_id_db(
                pool,
                organisation.to_owned(),
                application.to_owned(),
                key_id.clone(),
            )
            .await?
        }
        Some(cache) => {
            // key_unlabeled: the key ID is high-cardinality and must not become a
            // Prometheus label value.
            let cache_key = cache.key_unlabeled(
                organisation,
                application,
                &["signing_key", "key_id", &key_id],
            );

            match cache.get::<ActiveSigningKey>(&cache_key).await? {
                Some(hit) => Some(hit),
                None => {
                    let key = fetch_key_by_id_db(
                        pool,
                        organisation.to_owned(),
                        application.to_owned(),
                        key_id.clone(),
                    )
                    .await?;

                    // Only ever cache a key the database actually returned. `key_id`
                    // arrives on an unauthenticated request, so caching the misses too
                    // would let anyone mint an unbounded number of Redis keys just by
                    // asking for keys that do not exist.
                    if let Some(key) = &key {
                        if let Err(e) = cache.set_ex(&cache_key, key, KEY_CACHE_TTL_SECS).await {
                            warn!("Failed to cache signing key {key_id}: {e}");
                        }
                    }

                    key
                }
            }
        }
    };

    key.map(Some).ok_or_else(|| {
        ABError::BadRequest("Unknown or disabled signing key in X-Signing-Key-Id".to_string())
    })
}

// ---------------------------------------------------------------------------
// Signature cache
// ---------------------------------------------------------------------------

/// A signature, cached against the release config it was computed over.
#[derive(Serialize, Deserialize, Clone, Debug)]
struct CachedSignature {
    key_id: String,
    /// Base64 of the DER signature.
    signature: String,
}

/// Cache key for one (release config, signing key) pair.
fn signature_cache_key(
    cache: &RedisCache,
    organisation: &str,
    application: &str,
    selector: &str,
    config_version: &str,
) -> RedisKey {
    cache.key_unlabeled(
        organisation,
        application,
        &["release_sig", selector, config_version],
    )
}

/// The set of signature cache keys currently held for an application.
fn signature_index_key(cache: &RedisCache, organisation: &str, application: &str) -> RedisKey {
    cache.key(organisation, application, &["release_sig_index"])
}

fn decrypted_signing_key_cache_key(
    cache: &MokaCache,
    organisation: &str,
    application: &str,
    key_id: &str,
) -> MokaKey {
    cache.key(
        organisation,
        application,
        &["signing_key", "decrypted", key_id],
    )
}

fn signature_cache_selector(requested_key_id: Option<&str>) -> Result<String, ABError> {
    match requested_key_id {
        None => Ok("default".to_string()),
        Some(raw_key_id) => {
            let key_id = validate_key_id(raw_key_id).map_err(|_| {
                ABError::BadRequest(
                    "Unknown or disabled signing key in X-Signing-Key-Id".to_string(),
                )
            })?;
            Ok(format!("key:{key_id}"))
        }
    }
}

/// Sign a release-config body, reusing a cached signature for the same signing
/// key selector and `config.version`. A new config version must be minted
/// whenever the resolved release body changes.
pub async fn sign_release_config(
    state: &AppState,
    organisation: &str,
    application: &str,
    requested_key_id: Option<&str>,
    config_version: &str,
    body: &[u8],
) -> Result<Option<String>, ABError> {
    // An empty config version would collide across releases, so never key on one.
    let cacheable = !config_version.is_empty();
    let selector = signature_cache_selector(requested_key_id)?;

    let cache_key = state
        .redis_cache
        .as_ref()
        .filter(|_| cacheable)
        .map(|cache| {
            (
                cache,
                signature_cache_key(cache, organisation, application, &selector, config_version),
            )
        });

    if let Some((cache, key)) = &cache_key {
        if let Some(hit) = cache.get::<CachedSignature>(key).await? {
            return Ok(Some(signature_header_value(&hit.key_id, &hit.signature)));
        }
    }

    let Some(key) = resolve_signing_key(state, organisation, application, requested_key_id).await?
    else {
        return Ok(None);
    };

    let decrypted_key_cache_key =
        decrypted_signing_key_cache_key(&state.moka_cache, organisation, application, &key.key_id);
    let encrypted_private_key = key.private_key_encrypted.clone();
    let master_encryption_key = state.master_encryption_key.clone();
    let private_key = state
        .moka_cache
        .get_or_try_set::<String, _, _>(&decrypted_key_cache_key, || async move {
            decrypt_private_key(&encrypted_private_key, master_encryption_key.as_deref()).await
        })
        .await;

    let signature = match private_key.and_then(|private_key| sign_payload(&private_key, body)) {
        Ok(signature) => signature,
        Err(e) => {
            error!(
                "Failed to sign release config for {organisation}/{application}: {e}. \
                 Serving unsigned."
            );
            return Ok(None);
        }
    };

    if let Some((cache, cache_key)) = &cache_key {
        let ttl_secs = state.env.rc_signature_cache_ttl;
        let entry = CachedSignature {
            key_id: key.key_id.clone(),
            signature: signature.clone(),
        };
        if cache.set_ex(cache_key, &entry, ttl_secs).await.is_ok() {
            let index = signature_index_key(cache, organisation, application);
            if let Err(e) = cache.index_add(&index, cache_key, ttl_secs).await {
                warn!("Failed to index cached signature: {e}. Dropping the cache entry.");
                let _ = cache.del(cache_key).await;
            }
        }
    }

    Ok(Some(signature_header_value(&key.key_id, &signature)))
}

/// Drop every cached release-config signature for an application.
pub async fn invalidate_signature_cache(state: &AppState, organisation: &str, application: &str) {
    let Some(cache) = &state.redis_cache else {
        return;
    };

    let index = signature_index_key(cache, organisation, application);
    if let Err(e) = cache.index_drop(&index).await {
        let ttl_secs = state.env.rc_signature_cache_ttl;
        error!(
            "Failed to drop cached signatures for {organisation}/{application}: {e}. \
             Stale signatures may be served for up to {ttl_secs}s."
        );
    }
}

/// Drop the cached entries for an application's keys. Called after every
/// mutation so a disable or a default change takes effect immediately.
pub async fn invalidate_key_cache(
    state: &AppState,
    organisation: &str,
    application: &str,
    key_id: &str,
) {
    let decrypted_key_cache_key =
        decrypted_signing_key_cache_key(&state.moka_cache, organisation, application, key_id);
    state.moka_cache.del(&decrypted_key_cache_key).await;

    let Some(cache) = &state.redis_cache else {
        return;
    };

    let default_key = cache.key(
        organisation,
        application,
        &["signing_key", "implicit_default"],
    );
    if let Err(e) = cache.del(&default_key).await {
        warn!("Failed to invalidate default signing key cache: {e}");
    }

    let by_id = cache.key_unlabeled(
        organisation,
        application,
        &["signing_key", "key_id", key_id],
    );
    if let Err(e) = cache.del(&by_id).await {
        warn!("Failed to invalidate signing key cache for {key_id}: {e}");
    }

    // Which key signs has changed, so every signature cached under the old one
    // has to go with it.
    invalidate_signature_cache(state, organisation, application).await;
}

// ---------------------------------------------------------------------------
// Management operations
// ---------------------------------------------------------------------------

pub async fn list_keys(
    pool: DbPool,
    organisation: String,
    application: String,
) -> Result<Vec<SigningKeyEntry>, ABError> {
    run_blocking!({
        let mut conn = pool.get()?;
        let keys = signing_keys_table
            .filter(sk_org_id.eq(&organisation))
            .filter(sk_app_id.eq(&application))
            .order((sk_is_default.desc(), sk_updated_at.desc()))
            .select(SigningKeyEntry::as_select())
            .load::<SigningKeyEntry>(&mut conn)?;
        Ok(keys)
    })
}

pub async fn get_key(
    pool: DbPool,
    organisation: String,
    application: String,
    key_id: String,
) -> Result<SigningKeyEntry, ABError> {
    run_blocking!({
        let mut conn = pool.get()?;
        signing_keys_table
            .filter(sk_name.eq(&key_id))
            .filter(sk_org_id.eq(&organisation))
            .filter(sk_app_id.eq(&application))
            .select(SigningKeyEntry::as_select())
            .first::<SigningKeyEntry>(&mut conn)
            .optional()?
            .ok_or_else(|| ABError::NotFound("Signing key not found".to_string()))
    })
}

pub async fn create_key(
    pool: DbPool,
    master_encryption_key: Option<&str>,
    organisation: String,
    application: String,
    key_id: String,
) -> Result<SigningKeyEntry, ABError> {
    let keypair = generate_keypair()?;
    let private_key_encrypted =
        encrypt_private_key(&keypair.private_key, master_encryption_key).await?;

    run_blocking!({
        let mut conn = pool.get()?;

        // The very first key for an application becomes its default, so an app
        // is never left with keys but nothing to sign with.
        let has_default = diesel::select(diesel::dsl::exists(
            signing_keys_table
                .filter(sk_org_id.eq(&organisation))
                .filter(sk_app_id.eq(&application))
                .filter(sk_is_default.eq(true)),
        ))
        .get_result::<bool>(&mut conn)?;

        let new_key = NewSigningKey {
            id: Uuid::new_v4(),
            org_id: organisation.clone(),
            app_id: application.clone(),
            name: key_id.clone(),
            algorithm: ALGORITHM.to_string(),
            public_key: keypair.public_key.clone(),
            private_key_encrypted: private_key_encrypted.clone(),
            is_default: !has_default,
        };

        diesel::insert_into(signing_keys_table)
            .values(&new_key)
            .returning(SigningKeyEntry::as_returning())
            .get_result::<SigningKeyEntry>(&mut conn)
            .map_err(|e| match e {
                diesel::result::Error::DatabaseError(
                    diesel::result::DatabaseErrorKind::UniqueViolation,
                    _,
                ) => ABError::Conflict(format!("A signing key with ID '{key_id}' already exists")),
                other => other.into(),
            })
    })
}

/// Enable or disable a key.
pub async fn set_key_disabled(
    pool: DbPool,
    organisation: String,
    application: String,
    key_id: String,
    disabled: bool,
) -> Result<SigningKeyEntry, ABError> {
    run_blocking!({
        let mut conn = pool.get()?;

        let key = signing_keys_table
            .filter(sk_name.eq(&key_id))
            .filter(sk_org_id.eq(&organisation))
            .filter(sk_app_id.eq(&application))
            .select(SigningKeyEntry::as_select())
            .first::<SigningKeyEntry>(&mut conn)
            .optional()?
            .ok_or_else(|| ABError::NotFound("Signing key not found".to_string()))?;

        if disabled && key.is_default {
            return Err(ABError::BadRequest(
                "Cannot disable the default signing key. Make another key the default first."
                    .to_string(),
            ));
        }

        let updated = diesel::update(
            signing_keys_table
                .filter(sk_name.eq(&key_id))
                .filter(sk_org_id.eq(&organisation))
                .filter(sk_app_id.eq(&application)),
        )
        .set((
            sk_disabled.eq(disabled),
            sk_updated_at.eq(chrono::Utc::now()),
        ))
        .returning(SigningKeyEntry::as_returning())
        .get_result::<SigningKeyEntry>(&mut conn)?;

        Ok(updated)
    })
}

/// Promote a key to be the application's default.
pub async fn set_default_key(
    pool: DbPool,
    organisation: String,
    application: String,
    key_id: String,
) -> Result<SigningKeyEntry, ABError> {
    run_blocking!({
        let mut conn = pool.get()?;

        conn.transaction::<SigningKeyEntry, ABError, _>(|conn| {
            let key = signing_keys_table
                .filter(sk_name.eq(&key_id))
                .filter(sk_org_id.eq(&organisation))
                .filter(sk_app_id.eq(&application))
                .select(SigningKeyEntry::as_select())
                .first::<SigningKeyEntry>(conn)
                .optional()?
                .ok_or_else(|| ABError::NotFound("Signing key not found".to_string()))?;

            if key.disabled {
                return Err(ABError::BadRequest(
                    "Cannot make a disabled key the default. Enable it first.".to_string(),
                ));
            }

            diesel::update(
                signing_keys_table
                    .filter(sk_org_id.eq(&organisation))
                    .filter(sk_app_id.eq(&application))
                    .filter(sk_is_default.eq(true)),
            )
            .set(sk_is_default.eq(false))
            .execute(conn)?;

            let updated = diesel::update(
                signing_keys_table
                    .filter(sk_name.eq(&key_id))
                    .filter(sk_org_id.eq(&organisation))
                    .filter(sk_app_id.eq(&application)),
            )
            .set((sk_is_default.eq(true), sk_updated_at.eq(chrono::Utc::now())))
            .returning(SigningKeyEntry::as_returning())
            .get_result::<SigningKeyEntry>(conn)?;

            Ok(updated)
        })
    })
}

/// Give an application a default keypair if it has none.
pub async fn provision_default_key(
    pool: DbPool,
    master_encryption_key: Option<&str>,
    organisation: String,
    application: String,
) -> Result<(), ABError> {
    let keypair = generate_keypair()?;
    let private_key_encrypted =
        encrypt_private_key(&keypair.private_key, master_encryption_key).await?;

    run_blocking!({
        let mut conn = pool.get()?;

        let has_default = diesel::select(diesel::dsl::exists(
            signing_keys_table
                .filter(sk_org_id.eq(&organisation))
                .filter(sk_app_id.eq(&application))
                .filter(sk_is_default.eq(true)),
        ))
        .get_result::<bool>(&mut conn)?;

        if has_default {
            return Ok(());
        }

        let new_key = NewSigningKey {
            id: Uuid::new_v4(),
            org_id: organisation.clone(),
            app_id: application.clone(),
            name: DEFAULT_KEY_ID.to_string(),
            algorithm: ALGORITHM.to_string(),
            public_key: keypair.public_key.clone(),
            private_key_encrypted: private_key_encrypted.clone(),
            is_default: true,
        };

        match diesel::insert_into(signing_keys_table)
            .values(&new_key)
            .execute(&mut conn)
        {
            Ok(_) => Ok(()),
            // Another request or instance provisioned it first.
            Err(diesel::result::Error::DatabaseError(
                diesel::result::DatabaseErrorKind::UniqueViolation,
                _,
            )) => Ok(()),
            Err(e) => Err(e.into()),
        }
    })
}

/// Provision a default keypair for every application that does not have one.
///
/// Every instance runs this on boot. The unique constraints make a concurrent
/// run harmless, but not free: each instance would scan the same applications and
/// generate and encrypt a keypair for every one of them, only to throw all but
/// the winner away. One instance does the work, the rest skip — the same pattern
/// the superposition and Keycloak -> Casbin migrations use.
pub async fn backfill_default_keys(
    pool: DbPool,
    master_encryption_key: Option<&str>,
) -> Result<(), ABError> {
    let _lock_guard =
        match try_acquire_lock(&pool, LockNamespace::SigningKeyBackfill, "signingkeys").await? {
            Some(guard) => guard,
            None => {
                info!(
                    "Signing key backfill: another instance holds the lock, skipping on this one"
                );
                return Ok(());
            }
        };

    let backfill_pool = pool.clone();
    let missing: Vec<(String, String)> = run_blocking!({
        let mut conn = backfill_pool.get()?;

        let applications = workspace_names_table
            .select((wn_org_id, wn_app_id))
            .distinct()
            .load::<(String, String)>(&mut conn)?;

        let with_default = signing_keys_table
            .filter(sk_is_default.eq(true))
            .select((sk_org_id, sk_app_id))
            .load::<(String, String)>(&mut conn)?;

        let existing: std::collections::HashSet<(String, String)> =
            with_default.into_iter().collect();

        Ok(applications
            .into_iter()
            .filter(|pair| !existing.contains(pair))
            .collect())
    })?;

    if missing.is_empty() {
        info!("Signing key backfill: every application already has a default key");
        return Ok(());
    }

    info!(
        "Signing key backfill: provisioning default keys for {} application(s)",
        missing.len()
    );

    let mut provisioned = 0usize;
    for (organisation, application) in missing {
        match provision_default_key(
            pool.clone(),
            master_encryption_key,
            organisation.clone(),
            application.clone(),
        )
        .await
        {
            Ok(()) => provisioned += 1,
            // One bad application must not stop the rest of the backfill.
            Err(e) => error!(
                "Signing key backfill failed for {organisation}/{application}: {e}. Continuing."
            ),
        }
    }

    info!("Signing key backfill: provisioned {provisioned} default key(s)");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use p256::{
        ecdsa::{signature::Verifier, DerSignature, VerifyingKey},
        pkcs8::DecodePublicKey,
    };

    const BODY: &[u8] =
        br#"{"version":"2","config":{"version":"6f01a0ae-487a-4ca8-9ff8-9abc8dc53853"}}"#;

    #[test]
    fn generated_keypair_signs_and_verifies() {
        let keypair = generate_keypair().expect("keygen");

        // PKCS#8 for the private key, SPKI for the public key: what
        // `openssl pkey`, Java's KeyFactory, and iOS SecKey all expect.
        assert!(keypair.private_key.contains("BEGIN PRIVATE KEY"));
        assert!(keypair.public_key.contains("BEGIN PUBLIC KEY"));

        let signature_b64 = sign_payload(&keypair.private_key, BODY).expect("sign");

        let verifying_key =
            VerifyingKey::from_public_key_pem(&keypair.public_key).expect("parse public key");
        let der = BASE64.decode(&signature_b64).expect("decode base64");
        let signature = DerSignature::try_from(der.as_slice()).expect("parse DER signature");

        verifying_key.verify(BODY, &signature).expect("verify");
    }

    #[test]
    fn signature_does_not_verify_against_a_tampered_body() {
        let keypair = generate_keypair().expect("keygen");
        let signature_b64 = sign_payload(&keypair.private_key, BODY).expect("sign");

        let verifying_key =
            VerifyingKey::from_public_key_pem(&keypair.public_key).expect("parse public key");
        let der = BASE64.decode(&signature_b64).expect("decode base64");
        let signature = DerSignature::try_from(der.as_slice()).expect("parse DER signature");

        let tampered = br#"{"version":"2","config":{"version":"v6"}}"#;
        assert!(verifying_key.verify(tampered, &signature).is_err());
    }

    #[test]
    fn signature_does_not_verify_against_another_key() {
        let signer = generate_keypair().expect("keygen");
        let impostor = generate_keypair().expect("keygen");

        let signature_b64 = sign_payload(&signer.private_key, BODY).expect("sign");

        let verifying_key =
            VerifyingKey::from_public_key_pem(&impostor.public_key).expect("parse public key");
        let der = BASE64.decode(&signature_b64).expect("decode base64");
        let signature = DerSignature::try_from(der.as_slice()).expect("parse DER signature");

        assert!(verifying_key.verify(BODY, &signature).is_err());
    }

    #[test]
    fn signing_is_deterministic() {
        // RFC 6979 nonces: the same body and key must always give the same
        // signature, so a cached CDN response stays consistent with its header.
        let keypair = generate_keypair().expect("keygen");
        let first = sign_payload(&keypair.private_key, BODY).expect("sign");
        let second = sign_payload(&keypair.private_key, BODY).expect("sign");
        assert_eq!(first, second);
    }

    #[tokio::test]
    async fn encrypted_private_key_can_be_decrypted_and_used() {
        let keypair = generate_keypair().expect("keygen");
        let master_key = BASE64.encode([42_u8; 32]);

        let encrypted = encrypt_private_key(&keypair.private_key, Some(&master_key))
            .await
            .expect("encrypt");
        assert_ne!(encrypted, keypair.private_key);
        assert!(!encrypted.contains("BEGIN PRIVATE KEY"));

        let decrypted = decrypt_private_key(&encrypted, Some(&master_key))
            .await
            .expect("decrypt");
        let signature_b64 = sign_payload(&decrypted, BODY).expect("sign");

        let verifying_key =
            VerifyingKey::from_public_key_pem(&keypair.public_key).expect("parse public key");
        let der = BASE64.decode(&signature_b64).expect("decode base64");
        let signature = DerSignature::try_from(der.as_slice()).expect("parse DER signature");
        verifying_key.verify(BODY, &signature).expect("verify");
    }

    #[tokio::test]
    async fn encryption_disabled_preserves_plaintext_storage() {
        let keypair = generate_keypair().expect("keygen");

        let stored = encrypt_private_key(&keypair.private_key, None)
            .await
            .expect("store");
        assert_eq!(stored, keypair.private_key);
        assert_eq!(
            decrypt_private_key(&stored, None).await.expect("load"),
            keypair.private_key
        );
    }

    #[test]
    fn header_value_carries_key_id_and_algorithm() {
        let value = signature_header_value("release-signing-2026", "c2ln");
        assert_eq!(
            value,
            r#"keyid="release-signing-2026",alg="es256",sig="c2ln""#
        );
    }

    #[test]
    fn explicit_key_selector_cannot_collide_with_default() {
        let implicit = signature_cache_selector(None).expect("default selector");
        let explicit = signature_cache_selector(Some("default")).expect("explicit key selector");

        assert_eq!(implicit, "default");
        assert_eq!(explicit, "key:default");
        assert_ne!(implicit, explicit);
    }

    #[test]
    fn explicit_key_selector_uses_the_validated_key_id() {
        assert_eq!(
            signature_cache_selector(Some("release-signing-2026")).expect("key selector"),
            "key:release-signing-2026"
        );
    }

    #[test]
    fn an_empty_signing_key_header_falls_back_to_the_default_key() {
        // A client that sets X-Signing-Key-Id unconditionally from an unset
        // config field sends an empty value. That must mean "use the default",
        // not "use the key named ''" — which would 400 the whole release config.
        assert_eq!(requested_key_id(None), None);
        assert_eq!(requested_key_id(Some("")), None);
        assert_eq!(requested_key_id(Some("   ")), None);
    }

    #[test]
    fn a_populated_signing_key_header_is_an_explicit_request() {
        assert_eq!(
            requested_key_id(Some("release-signing-2026")),
            Some("release-signing-2026")
        );
        assert_eq!(requested_key_id(Some("  spaced  ")), Some("spaced"));
    }

    #[test]
    fn key_id_validation_accepts_lowercase_letters_digits_and_single_dashes() {
        for key_id in ["default", "key1", "release-signing-2026", "a"] {
            assert_eq!(validate_key_id(key_id).expect("valid key ID"), key_id);
        }

        let max_length = "a".repeat(SIGNING_KEY_ID_MAX_LENGTH);
        assert_eq!(
            validate_key_id(&max_length).expect("maximum-length key ID"),
            max_length
        );
    }

    #[test]
    fn key_id_validation_rejects_invalid_formats() {
        for key_id in [
            "",
            "Release-Key",
            "release key",
            "release_key",
            "release.key",
            "-release",
            "release-",
            "release--key",
            "release/key",
            "rélèase",
        ] {
            assert!(
                matches!(validate_key_id(key_id), Err(ABError::BadRequest(_))),
                "expected {key_id:?} to be rejected"
            );
        }

        let too_long = "a".repeat(SIGNING_KEY_ID_MAX_LENGTH + 1);
        assert!(matches!(
            validate_key_id(&too_long),
            Err(ABError::BadRequest(_))
        ));
    }
}
