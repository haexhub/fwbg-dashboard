---
id: self-modifying-instructions-review-gated
kind: constitution_fragment
atom_source: atoms.spaex-constitution
modality: MUST
tags: [governance, review-gate]
---
Any change an agent proposes to skill files, instruction snippets, permissions, constitutions themselves, or any other artifact the agent consumes on future runs **MUST** land as a proposed diff, a commit or PR, never an in-place auto-write; a human MUST review and merge it. A schema migration of a versioned config file (`.spaex.json`, `install.lock`, `constitution.md`, `manifest.json`, or a successor schema) MUST run through an explicit migration verb (e.g. spec-007's `spaex migrate`) that writes candidate output to a `.migrated` sidecar rather than the original file, prints a reviewable diff, is deterministic given identical inputs, and supports `--dry-run`/`--check`; no in-place rewrite of a versioned config file by an agent or tool is permitted, and the review gate is the point at which the sidecar replaces the original. Unreviewed self-modification drifts: instructions overfit to one-off incidents, accumulate contradictions, and quietly change how agents behave in ways nobody chose.
