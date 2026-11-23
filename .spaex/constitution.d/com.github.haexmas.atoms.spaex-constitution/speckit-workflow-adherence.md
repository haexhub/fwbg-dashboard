---
id: speckit-workflow-adherence
kind: constitution_fragment
atom_source: atoms.spaex-constitution
modality: MUST
tags: [workflow, speckit]
---
Every feature or spec created via `/speckit-specify` **MUST** be checked against this constitution's principles during `/speckit-plan`; any conflict is resolved by changing the plan or escalated to a constitution amendment, never silently accepted as an exception. The project's active speckit workflow, declared at `.specify/workflows/speckit/workflow.yml`, MUST be followed for every primary task landing, invoking the named commands at their corresponding stages; when that file is absent, the built-in speckit skills serve as the implicit default and MUST still be followed. Freehand edits against source files are permitted only for review-fix responses on an already-open PR, or follow-up doc-alignment surfaced during a walkthrough test, never for the primary task landing itself.
