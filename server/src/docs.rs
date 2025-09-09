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

use actix_files::{Files, NamedFile};
use actix_web::{web, Scope, Result};

async fn index() -> Result<NamedFile> {
    Ok(NamedFile::open("./docs_react/dist/index.html")?)
}

pub fn add_routes() -> Scope {
    Scope::new("/docs")
    .service(
        Scope::new("home")
        .route("", web::get().to(index))
    )
    .service(
        Files::new("/", "./docs_react/dist").index_file("index.html"),
    )
}
