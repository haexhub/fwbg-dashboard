---
id: haex-vault-devshell-commands
kind: constitution_fragment
atom_source: haex-vault-devshell-commands
tags: [haex-vault, nix, devshell, node, pnpm, cargo, prettier]
---
# Capability: run haex-vault's tooling inside its Nix devShell

**Status**: Part of molecule `com.github.haexmas.atoms.haex-vault`.
**Applies to**: agents that build, test or format code in a haex-vault checkout or worktree.

## Rule

`node`, `pnpm` and the Rust toolchain exist only inside haex-vault's Nix devShell. An agent's
shell does not load it (direnv's hook fires at an interactive prompt, not for a single
command), so a bare `node`, `pnpm`, `prettier` or `cargo` is either not found or is a
different version than CI uses. The agent SHOULD run them through
`nix develop --command <command>` from the checkout it is working in.

## Operating protocol

1. Frontend and script commands: `nix develop --command pnpm <script>`, for example
   `pnpm exec prettier --write <paths>`, `pnpm lint`, `pnpm typecheck`.
2. Cargo needs the host bridge as well:
   `nix develop --command scripts/with-nix-host-bridge.sh cargo <args>`. Plain
   `nix develop --command cargo ...` fails in the GTK/WebKit sys crates.
3. A fresh worktree has no `node_modules`. Run `nix develop --command pnpm install
   --frozen-lockfile` in it before using `pnpm exec`; do not call the
   `node_modules/.bin/*` of another checkout from outside the devShell (its shim runs
   `node`, which is missing there), and do not symlink `node_modules` between worktrees.
4. Prettier covers the whole repository, including `specs/` and `docs/`. Run
   `pnpm exec prettier --write` on every Markdown or JSON file the change touches before
   committing, because `pnpm format:check` is a CI check.
5. When a command fails with `node: not found`, `tauri: not found` or a GTK/WebKit
   linker error, first check that it ran through `nix develop --command` (the variable
   `IN_NIX_SHELL` is set inside the devShell) before looking for another cause.
