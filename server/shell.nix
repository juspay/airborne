let
  pkgs = import <nixpkgs> {};
in
  with pkgs;
  mkShell {
    buildInputs =
      let univPkgs = [
        rustc
        cargo
        rust-analyzer
        clippy
        cargo-watch
        bacon
        rustfmt
        # openssl.dev
        pkg-config
        zlib
        nodePackages.npm
        nodejs
        libiconv
        # openssl
        stdenv.cc
      ];
      darwinPkgs = [
        darwin.apple_sdk.frameworks.Security
      ];
      in
      univPkgs ++ (if pkgs.stdenv.isDarwin then darwinPkgs else []);
    }
#NOTE to use zsh inside nix-shell, install https://github.com/chisui/zsh-nix-shell plugin
