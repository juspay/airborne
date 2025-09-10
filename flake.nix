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
        formatter = pkgs.nixpkgs-fmt;
        devShells.default = pkgs.mkShell {
          inputsFrom = [
            self'.devShells.rust
            config.pre-commit.devShell
          ];
          packages = [
            pkgs.podman-compose
            # pkgs.docker-compose
            pkgs.gnumake
            pkgs.diesel-cli
            pkgs.postgresql_15
            pkgs.cargo-watch
            pkgs.jq
            pkgs.yq
            pkgs.curl
            pkgs.awscli2
            pkgs.pkg-config
            pkgs.openssl
            pkgs.cyrus_sasl  # Required for analytics server Kafka support
          ] ++ pkgs.lib.optionals pkgs.stdenv.isDarwin [
            pkgs.libiconv
          ];
        };
        packages.default = self'.packages.airborne-server;
      };
    };
}
