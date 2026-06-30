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

      perSystem = { self', pkgs, config, ... }:
        let
          v8Target = if pkgs.stdenv.isDarwin then "aarch64-apple-darwin" else "x86_64-unknown-linux-gnu";
          v8_lib = pkgs.fetchurl {
            url = "https://github.com/denoland/rusty_v8/releases/download/v137.3.0/librusty_v8_release_${v8Target}.a.gz";
            sha256 =
              if pkgs.stdenv.isDarwin then
                "0w70ykqip4a84z3cb5vibdqw91lywwahl9pc05mw8lp54ikksl30"
              else
                "0rv5nl4gcbvdpk3mdwbqvw180nfx2wk173q1cqrvv2h1agg1ys52";
          };
          v8_binding = pkgs.fetchurl {
            url = "https://github.com/denoland/rusty_v8/releases/download/v137.3.0/src_binding_release_${v8Target}.rs";
            sha256 =
              if pkgs.stdenv.isDarwin then
                "14mb5dly52wjnbzv5arv0mhkqm4162ah2wln5dzrz2w6diyryy26"
              else
                "1gjqymsz7zc4d61cb6h02l90z1hpff4haagc81ixlk9ipg7p73ng";
          };
          v8_mirror = pkgs.linkFarm "v8-mirror" [
            {
              name = "v137.3.0/librusty_v8_release_${v8Target}.a.gz";
              path = v8_lib;
            }
            {
              name = "v137.3.0/src_binding_release_${v8Target}.rs";
              path = v8_binding;
            }
          ];
        in
        {
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
        rust-project.crates.airborne_server.crane.args = {
          buildInputs = [ pkgs.postgresql_15 pkgs.openssl ];
          nativeBuildInputs = [ pkgs.pkg-config ];
          RUSTY_V8_MIRROR = v8_mirror;
          RUSTY_V8_SRC_BINDING_PATH = "${v8_mirror}/v137.3.0/src_binding_release_${v8Target}.rs";
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
