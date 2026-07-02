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

use actix_files::Files;
use actix_web::{web, HttpResponse, Scope};
use std::path::Path;

fn docs_dir() -> String {
    std::env::var("DOCS_DIR").unwrap_or_else(|_| "./docs_dist".to_string())
}

async fn docs_not_built() -> HttpResponse {
    HttpResponse::NotFound()
        .content_type("text/html; charset=utf-8")
        .body(
            "<!doctype html><meta charset=\"utf-8\"><title>Docs not built</title>\
             <body style=\"font-family:system-ui;max-width:42rem;margin:4rem auto;padding:0 1rem\">\
             <h1>Documentation not built</h1>\
             <p>The Docusaurus site has not been built into this server.</p>\
             <ul>\
             <li>Local development: run <code>make docs</code> and open \
             <a href=\"http://localhost:3001/docs/\">http://localhost:3001/docs/</a> (hot reload).</li>\
             <li>To serve a static build from this server: run <code>make docs-build</code> and set \
             <code>DOCS_DIR</code> (e.g. <code>../airborne_docs/build</code>).</li>\
             </ul></body>",
        )
}

pub fn add_routes() -> Scope {
    let dir = docs_dir();
    if Path::new(&dir).is_dir() {
        log::info!("Serving documentation from '{dir}' at /docs");
        Scope::new("/docs").service(Files::new("", dir).index_file("index.html"))
    } else {
        log::warn!("Documentation directory '{dir}' not found; serving a placeholder at /docs (build with `make docs-build` or set DOCS_DIR).");
        Scope::new("/docs").default_service(web::route().to(docs_not_built))
    }
}
