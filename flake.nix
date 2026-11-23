{
  description = "Reproducible Nix devShell skeleton, delivered by spaex";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    # Rust toolchains with cross targets (Android, ...), which nixpkgs' own
    # `rustc` cannot add: used only when a molecule delivers
    # `.devshell/rust-toolchain.toml` (see `rustToolchainPath` below).
    rust-overlay = {
      url = "github:oxalica/rust-overlay";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = { self, nixpkgs, flake-utils, rust-overlay }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        # Blanket allow, not a per-package predicate: `cudatoolkit` (pulled
        # in by consumers like `com.github.haexmas.atoms.haex-vault` for local
        # CUDA builds) is a meta-package bundling several separately
        # unfree-licensed sub-derivations (cuda_nvcc, cuda_cuobjdump, ...),
        # so scoping to one name is not enough and the set of names is not
        # stable across nixpkgs bumps. Revisit if a consumer ever needs
        # finer-grained control.
        pkgs = import nixpkgs {
          inherit system;
          config.allowUnfree = true;
          overlays = [ rust-overlay.overlays.default ];
        };

        # spaex regenerates this from every currently-adopted molecule's
        # `nix_packages` fragment (spaex Spec 027's composable atom
        # category). Absent when no adopted molecule declares one — that
        # is a valid "no extra packages" state, not an error.
        generatedPackagesPath = ./.spaex/generated/nix-packages.json;
        packageNames =
          if builtins.pathExists generatedPackagesPath
          then builtins.fromJSON (builtins.readFile generatedPackagesPath)
          else [ ];
        # A plain name ("gtk3") indexes pkgs directly; a dotted name
        # ("gcc.cc.lib", "dbus.lib") walks nested attrs — needed because some
        # nixpkgs packages split their shared libraries into a non-default
        # output (e.g. plain `glib` resolves to its "bin" output, not the
        # one containing libglib-2.0.so; `dbus`'s library lives in `.lib`,
        # not its default "out").
        resolvePackage = name: pkgs.lib.getAttrFromPath (pkgs.lib.splitString "." name) pkgs;
        # Packages nixpkgs does not ship, or ships in a form that would clash with the
        # host, come from an optional file another molecule delivers:
        # `.devshell/packages.nix`, a function from `pkgs` to a list of
        # derivations. Read with the same guard as the list above, so no adopted
        # molecule delivering it is a valid state. The file must be tracked by git
        # like every other file a flake reads, and only one molecule can own that
        # path (an exclusive atom), so this is an extension point for one
        # contributor, not a composable category.
        extraPackagesPath = ./.devshell/packages.nix;
        extraPackages =
          if builtins.pathExists extraPackagesPath
          then import extraPackagesPath pkgs
          else [ ];
        # A Rust toolchain described like rustup's `rust-toolchain.toml`
        # (channel, components, targets), delivered by a molecule as an
        # exclusive atom under `.devshell/` so that rustup in CI, which reads
        # a `rust-toolchain.toml` at the repo root, never picks it up. When
        # present it replaces the nixpkgs Rust packages (`nix-rust`'s
        # fragment): two `rustc` on PATH would decide by order which one
        # builds. Read with the same guard as the files above.
        rustToolchainPath = ./.devshell/rust-toolchain.toml;
        hasRustToolchain = builtins.pathExists rustToolchainPath;
        nixpkgsRust = [ "rustc" "cargo" "clippy" "rustfmt" ];
        rustToolchain = pkgs.lib.optional hasRustToolchain
          (pkgs.rust-bin.fromRustupToolchainFile rustToolchainPath);
        hostPlatform = pkgs.stdenv.hostPlatform;
        # CUDA's package set can fail before its platform metadata is available.
        supportedNames = builtins.filter (name:
          (name != "cudatoolkit" || hostPlatform.isLinux)
          && (!hasRustToolchain || !(builtins.elem name nixpkgsRust))
        ) packageNames;
        resolvedNames = builtins.filter (name:
          pkgs.lib.meta.availableOn hostPlatform (resolvePackage name)
        ) supportedNames;
        packages = map resolvePackage resolvedNames ++ rustToolchain ++ extraPackages;
      in
      {
        devShells.default = pkgs.mkShell {
          inherit packages;
          # Nix's own dynamic linker doesn't consult the host's ld.so.cache,
          # so anything the devShell's packages provide at runtime (not just
          # build time) needs to be on LD_LIBRARY_PATH explicitly — RPATH
          # alone isn't reliable here since Tauri's own build process
          # overwrites it with a bundle-relative convention. Generic by
          # construction: driven entirely by whatever nix_packages molecules
          # contribute, no per-package or per-consumer special-casing — with
          # the one exception below, which is itself gated on a contributed
          # package name.
          shellHook = ''
            # Append the inherited value only when non-empty: a trailing `:`
            # is an empty element, which makes ld.so search the working directory.
            export LD_LIBRARY_PATH="${pkgs.lib.makeLibraryPath packages}''${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
          '' + pkgs.lib.optionalString (builtins.elem "cudatoolkit" resolvedNames) ''
            # `cudarc` (pulled in by `mistralrs/cuda`) looks for one of
            # CUDA_HOME/CUDA_PATH/CUDA_ROOT/CUDA_TOOLKIT_ROOT_DIR at build time to
            # find -lcudart/-lnvrtc/-lcurand/-lcublas/-lcublasLt — unlike
            # LD_LIBRARY_PATH above, this is consulted by the *linker*, not the
            # dynamic loader, and without it cudarc falls back to host paths like
            # /usr/local/cuda that don't exist in this Nix-provided toolchain.
            # Gated on the contributed *name*, not on `pkgs.cudatoolkit` itself:
            # comparing derivations would evaluate cudatoolkit for every consumer,
            # and it does not evaluate on platforms nixpkgs does not support it on.
            export CUDA_ROOT="${pkgs.cudatoolkit}"
          '' + pkgs.lib.optionalString (builtins.elem "llvmPackages.libclang.lib" resolvedNames) ''
            # `bindgen` (via `clang-sys`, used by crates that build bindings at compile
            # time, e.g. `libsqlite3-sys` with rusqlite's `preupdate_hook`) loads
            # libclang at *build* time. Left to itself it takes the host's
            # /usr/lib/libclang.so first, which cannot find its own libLLVM from inside
            # this shell's dynamic linker and fails with "Unable to find libclang".
            # `LIBCLANG_PATH` takes precedence over that search. It must be the libclang
            # of *this* nixpkgs: one from another nixpkgs brings another glibc and fails
            # with `GLIBC_PRIVATE` errors in the build script. Gated on the contributed
            # *name*, like CUDA_ROOT above.
            export LIBCLANG_PATH="${pkgs.llvmPackages.libclang.lib}/lib"
          '';
        };
      });
}
