{
  description = "Airborne server";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-parts.url = "github:hercules-ci/flake-parts";
    rust-flake.url = "github:juspay/rust-flake";
  };

  outputs = inputs:
    inputs.flake-parts.lib.mkFlake { inherit inputs; } {
      imports = [
        inputs.rust-flake.flakeModules.default
        inputs.rust-flake.flakeModules.nixpkgs
        # FIX ME: Import rust.nix and do not update devShells
        # ./rust.nix
      ];
      systems = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];

      perSystem = { self', pkgs, ... }: {
        devShells.default = pkgs.mkShell {
          inputsFrom = [
            self'.devShells.rust
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
          ] ++ pkgs.lib.optionals pkgs.stdenv.isDarwin [
            pkgs.libiconv
          ];
        };
        packages.default = self'.packages.airborne-server;
      };
    };
}