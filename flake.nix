{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-parts.url = "github:hercules-ci/flake-parts";
    systems.url = "github:nix-systems/default";
    pre-commit-hooks.url = "github:cachix/pre-commit-hooks.nix";
    rust-flake.url = "github:juspay/rust-flake";
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
          buildInputs = [ pkgs.openssl pkgs.cyrus_sasl ];
          nativeBuildInputs = [ pkgs.pkg-config pkgs.cmake ];
        };
        rust-project.crates.airborne-server.crane.args = {
          buildInputs = [ pkgs.postgresql_15 pkgs.openssl ];
          nativeBuildInputs = [ pkgs.pkg-config ];
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
            pkgs.jq
            pkgs.yq
            pkgs.curl
            pkgs.awscli2
          ] ++ pkgs.lib.optionals pkgs.stdenv.isDarwin [
            pkgs.libiconv
          ];
        };
        packages.default = self'.packages.airborne-server;
      };
    };
}
