---
id: merge-strategy-no-squash
kind: constitution_fragment
atom_source: atoms.spaex-constitution
modality: MUST_NOT
tags: [workflow, git]
---
A pull request **MUST NOT** be squash-merged, because squashing collapses the per-commit Conventional-Commits messages into a single auto-composed message and destroys the type information that changelog and version-bump tooling reads. A PR MUST be merged with rebase-merge (the default, for its linear history) or merge-commit (a legitimate choice when PR-boundary visibility in `git log --graph` is wanted); for a merge-commit, the maintainer MUST replace GitHub's auto-generated "Merge pull request ..." subject with a Conventional-Commits header before merging. Commit-message validation and changelog tooling MUST validate and process merge commits and MUST NOT exempt auto-generated merge subjects.
