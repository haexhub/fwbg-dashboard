---
id: conventional-commit-messages
kind: constitution_fragment
atom_source: atoms.spaex-constitution
modality: MUST
tags: [workflow, git]
---
Every commit message **MUST** follow Conventional Commits v1.0.0: header shape `<type>[optional scope][!]: <description>`, with an optional body and footer(s). A breaking change MUST be marked with `!` before the colon (for example `feat(api)!: ...`) and should include a `BREAKING CHANGE:` footer explaining what breaks and how to migrate. The standard types apply: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `build`, `ci`, `style`, `revert`; there is no custom `break:` type, since breakage is an orthogonal marker, not a type. This requirement applies from version 1.2.0 onward; commits made before its adoption are grandfathered and are not policy violations.
