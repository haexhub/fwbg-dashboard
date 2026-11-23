---
id: cross-repo-refs-pin-immutable-revisions
kind: constitution_fragment
atom_source: atoms.spaex-constitution
modality: MUST
tags: [reproducibility, cross-repo]
---
When a project references content in an external harness repo, the reference **MUST** take the form `repository + full commit SHA + repo-relative path`, and the SHA **MUST** be an immutable git object reference. Branch or `HEAD` references are permitted only for explicit "living document" cases, never for anything a spec, plan, or task consumes. The path component may address either a single file or a directory whose canonical descriptor is `<path>/manifest.json`; the SHA and immutability rule are unchanged either way. Resolving the same reference on different days MUST produce byte-identical content; anything else creates silent drift that only surfaces later as inconsistent agent behavior.
