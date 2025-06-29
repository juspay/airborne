use actix_files::Files;
use actix_web::{web, Scope};
use std::path::Path;

pub async fn index() -> Result<actix_files::NamedFile, std::io::Error> {
    let path = Path::new("home_react/dist/index.html");
    Ok(actix_files::NamedFile::open(path)?)
}

pub fn add_routes() -> Scope {
    web::scope("home")

        .service(Files::new("/", "home_react/dist"))
}
