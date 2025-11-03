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

use tracing_subscriber::{fmt, layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};
// use tracing_appender::rolling;

pub mod db;
pub mod document;
pub mod encryption;
pub mod keycloak;
pub mod kms;
pub mod s3;
pub mod semver;
pub mod transaction_manager;
pub mod workspace;

pub fn init_tracing(log_format: String) {
    let (nb_stderr, stderr_guard) = tracing_appender::non_blocking(std::io::stderr());

    static mut STDERR_GUARD: Option<tracing_appender::non_blocking::WorkerGuard> = None;
    unsafe {
        STDERR_GUARD = Some(stderr_guard);
    }

    let filter =
        EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info,actix_web=warn"));

    if log_format == "json" {
        let layer = fmt::layer().json().with_writer(nb_stderr);

        tracing_subscriber::registry()
            .with(filter)
            .with(tracing_error::ErrorLayer::default())
            .with(layer)
            .init()
    } else {
        let layer = fmt::layer().compact().with_writer(nb_stderr);

        tracing_subscriber::registry()
            .with(filter)
            .with(tracing_error::ErrorLayer::default())
            .with(layer)
            .init()
    }
}
