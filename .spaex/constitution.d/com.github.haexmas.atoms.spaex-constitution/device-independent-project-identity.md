---
id: device-independent-project-identity
kind: constitution_fragment
atom_source: atoms.spaex-constitution
modality: MUST
tags: [identity, portability]
---
A project's identity **MUST** be its git remote URL, or, for a non-git folder project, an opaque id file (`.harness-id`) inside the folder, never a filesystem path. Path resolution (mapping a project's identity to where it actually lives on disk) is strictly a local, private concern of the machine doing the resolving; a project's identity must not depend on where it happens to live on one particular machine.
