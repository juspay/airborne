{ inputs, ... }:
{
  perSystem = { pkgs, system, ... }:
    let
      craneLib = inputs.crane.mkLib pkgs;
      airborne = craneLib.buildPackage {
        src = craneLib.cleanCargoSource (craneLib.path ./.);
        strictDeps = true;

        buildInputs = [
          # Add additional build inputs here
          # pkgs.openssl
          pkgs.diesel-cli
          pkgs.rust-analyzer
          pkgs.bacon
          pkgs.cargo-watch
          pkgs.rustfmt
          pkgs.clippy
          pkgs.postgresql_15
          pkgs.yq
        ];

        nativeBuildInputs = [
          pkgs.pkg-config
        ] ++ pkgs.lib.optionals pkgs.stdenv.isDarwin [
          pkgs.libiconv
        ];
      };
    in
    {
      packages.airborne = airborne;
      checks = {
        inherit airborne;
      };
    };
}
