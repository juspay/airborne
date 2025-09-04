{ inputs, ... }:
{
  perSystem = { pkgs, system, ... }:
    {
      rust-project.crates."airborne-server".crane.args = {
        buildInputs = [
          pkgs.diesel-cli
          pkgs.bacon
          pkgs.postgresql_15
          pkgs.yq
        ];

        nativeBuildInputs = [
          pkgs.pkg-config
        ] ++ pkgs.lib.optionals pkgs.stdenv.isDarwin [
          pkgs.libiconv
        ];
      };
    };
}
