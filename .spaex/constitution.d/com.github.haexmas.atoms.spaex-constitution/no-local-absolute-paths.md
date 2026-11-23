---
id: no-local-absolute-paths
kind: constitution_fragment
atom_source: atoms.spaex-constitution
modality: MUST_NOT
tags: [portability]
---
**MUST NOT** commit anything to a harness or consuming repo that assumes one OS's layout: no `/home/...` paths, no `C:\Users\...` paths, no `~/...` paths. Everything committed MUST resolve identically on Linux, macOS, and WSL2. Cross-repo references use `repository + revision + repo-relative path` instead of a local path; a developer's own local path mappings stay in their own environment, outside version control. A committed path that assumes one layout silently breaks on another, usually mid-session and hard to diagnose.
