---
id: constitution-enforcement-tooling
kind: constitution_fragment
atom_source: atoms.spaex-constitution
modality: MUST
tags: [governance, enforcement]
---
`/speckit-plan` and `/speckit-analyze` MUST check plans and cross-artifact consistency against this constitution. CI does not yet mechanically enforce this; when introduced, it MUST validate that no committed file violates the no-secrets-in-git, no-local-absolute-paths, or cross-repo-refs-pin-immutable-revisions principles.
