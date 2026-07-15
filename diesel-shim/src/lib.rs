//! Transparent re-export of [`juspay_diesel`] under the crate name `diesel`.
//!
//! This exists solely so the workspace's `[patch.crates-io]` entry can point the
//! crates.io `diesel` dependency (pulled in by the casbin `diesel-adapter`) at
//! Juspay's diesel fork. `[patch]` cannot rename a crate, so it needs a stand-in
//! actually named `diesel`; every item — types, traits, and the `#[macro_export]`
//! / derive macros — is re-exported unchanged, so `diesel::…` paths in
//! downstream crates resolve to `juspay_diesel::…`.
pub use juspay_diesel::*;
