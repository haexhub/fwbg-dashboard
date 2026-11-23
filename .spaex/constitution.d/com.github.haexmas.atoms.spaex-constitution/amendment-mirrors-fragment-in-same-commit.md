---
id: amendment-mirrors-fragment-in-same-commit
kind: constitution_fragment
atom_source: atoms.spaex-constitution
modality: MUST
tags: [governance, amendment]
---
Amending a principle in this constitution's authoritative text **MUST** be mirrored in its corresponding fragment file (under `fragments/`, declared in `manifest.json`'s `atoms.behavior`) in the same commit. A principle change without a matching fragment update is incomplete: it leaves the machine-composed `.spaex.md` diverged from the human-readable text it is supposed to derive from.
