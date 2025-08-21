{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-parts.url = "github:hercules-ci/flake-parts";
    crane = {
      url = "github:ipetkov/crane";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    systems.url = "github:nix-systems/default";
  };

  outputs = inputs:
    inputs.flake-parts.lib.mkFlake { inherit inputs; } {
      systems = import inputs.systems;

      imports = [
        ./rust.nix
      ];

      perSystem = { self', pkgs, lib, system, ... }: {
        packages.default = self'.packages.airborne;

        devShells.default = pkgs.mkShell {
          inputsFrom = [
            self'.packages.airborne
          ];
          RUST_SRC_PATH = "${pkgs.rust.packages.stable.rustPlatform.rustLibSrc}";

          nativeBuildInputs = [
            pkgs.podman-compose
          ];
        };
      };
    };
}
