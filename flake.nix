{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-parts.url = "github:hercules-ci/flake-parts";
    systems.url = "github:nix-systems/default";
    pre-commit-hooks.url = "github:cachix/pre-commit-hooks.nix";
    rust-overlay.url = "github:oxalica/rust-overlay";
    rust-flake.url = "github:juspay/rust-flake";
    rust-flake.inputs.rust-overlay.follows = "rust-overlay";
  };

  outputs = inputs:
    inputs.flake-parts.lib.mkFlake { inherit inputs; } {
      systems = import inputs.systems;

      imports = [
        inputs.rust-flake.flakeModules.default
        inputs.rust-flake.flakeModules.nixpkgs
        inputs.pre-commit-hooks.flakeModule
        # ./nix/pre-commit.nix
        # ./nix/rust.nix
      ];

      perSystem = { self', pkgs, config, ... }: {
        rust-project.src =
          pkgs.lib.cleanSourceWith {
            src = inputs.self;
            filter =
              path: type:
              (config.rust-project.crane-lib.filterCargoSources path type
              && !(pkgs.lib.hasSuffix ".toml" path && !pkgs.lib.hasSuffix "Cargo.toml" path))
              || (pkgs.lib.hasInfix "migrations" path && pkgs.lib.hasSuffix ".sql" path);
          };
        rust-project.crates.airborne_analytics_server.crane.args = {
          buildInputs = [ pkgs.openssl pkgs.cyrus_sasl pkgs.curl ];
          nativeBuildInputs = [ pkgs.pkg-config pkgs.cmake ];
        };
        rust-project.crates.airborne_server.crane.args = {
          buildInputs = [ pkgs.postgresql_15 pkgs.openssl ];
          nativeBuildInputs = [ pkgs.pkg-config ];
          DOCS_RS = "1";
          # `diesel` in this workspace is a local re-export shim (diesel-shim/)
          # that redirects the crates.io `diesel` pulled in by diesel-adapter and
          # diesel_migrations onto the juspay_diesel fork via [patch.crates-io].
          # crane's dependency-only build (cargoArtifacts) stubs every local
          # crate's source with an empty file, which erases the shim's
          # `pub use juspay_diesel::*;` and makes diesel_migrations / diesel-adapter
          # fail to resolve `diesel::backend`, `diesel::migration`, etc. Restore
          # the shim's real source into the dummy tree so the cached dependency
          # build compiles those crates against the actual re-export.
          dummySrc = config.rust-project.crane-lib.mkDummySrc {
            src = config.rust-project.src;
            extraDummyScript = ''
              mkdir -p "$out/diesel-shim/src"
              cp -f ${./diesel-shim/src/lib.rs} "$out/diesel-shim/src/lib.rs"
            '';
          };
        };
        formatter = pkgs.nixpkgs-fmt;
        devShells.default = pkgs.mkShell {
          inputsFrom = [
            self'.devShells.rust
            config.pre-commit.devShell
          ];
          packages = [
            pkgs.cocogitto
            pkgs.podman-compose
            pkgs.nodejs_22
            # pkgs.docker-compose
            pkgs.gnumake
            pkgs.diesel-cli
            pkgs.cargo-watch
            pkgs.cargo-edit
            pkgs.jq
            pkgs.yq
            pkgs.curl
            pkgs.awscli2
          ] ++ pkgs.lib.optionals pkgs.stdenv.isDarwin [
            pkgs.libiconv
          ];
        };
        packages.default = self'.packages.airborne_server;
      };
    };
}
