fn main() {
    // diesel's embed_migrations macro cannot tell Cargo about new SQL files.
    println!("cargo:rerun-if-changed=migrations");
}
