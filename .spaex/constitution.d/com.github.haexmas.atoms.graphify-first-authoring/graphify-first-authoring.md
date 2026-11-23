---
id: graphify-first-authoring
kind: constitution_fragment
atom_source: graphify-first-authoring
tags: [graphify, authoring, code-review, maintainability]
---
# Principle: graphify-first authoring

**Status**: Opt-in via molecule `com.github.haexmas.atoms.graphify-first-authoring`.
**Applies to**: any agent bound by a constitution assembled from this molecule.

## Rule

Before authoring **any new named function, class, component, store, module, or CLI command**, you MUST consult the project's `graphify` knowledge graph and prefer extending an existing candidate over authoring a parallel implementation.

## When the rule fires

The rule fires whenever you are about to introduce a **new named artifact** into the codebase:

- a function, method, class, or component (React/Svelte/etc.)
- a store, hook, service, or module
- a CLI command or public API endpoint

It does **not** fire for renames, in-place edits, trivial inline expressions, or code you are actively deleting.

## What to do (the loop)

1. **Classify the checkout exactly once, then bootstrap or refresh according to that class** (independent of any git hook running):
   - Apply this mutually exclusive precedence: a **linked worktree** is a checkout whose git directory is managed as a linked worktree; otherwise a **feature branch** is the branch carrying the current change or pull request, even when it has an upstream tracking ref; otherwise the checkout is a **tracked branch**. If the branch role is unclear, classify it as a feature branch.
   - A linked worktree or feature branch always uses the complete fork-point snapshot as-is. It never participates in current-`HEAD` freshness checks, even when its branch has an upstream remote or is also checked out in a repository that tracks it.
   - On a tracked branch, if `graphify-out/` or its required `graph.json` is **absent**, run `graphify update <repo-root>` to build the graph before continuing. A directory without `graph.json` is not a usable graph.
   - On a tracked branch, if `graphify-out/.meta.json` is absent, invalid, or its `indexed_at_sha` does **not** match current `HEAD`, run `graphify update <repo-root>` to refresh incrementally.
   - On a feature branch or linked worktree, use a complete fork-point snapshot as-is. Do not compare its marker with the feature branch's advancing `HEAD`, and do not refresh it. If the snapshot lacks `graph.json`, warn and continue with the normal consultation failure handling.
   - If bootstrap or refresh fails, warn, continue with the consultation/authoring flow, and flag the incomplete refresh for a later manual check. The failure MUST NOT block authoring.
   - These tracked-branch checks hold even when the git hooks are not installed or were bypassed (e.g. `git commit --no-verify`).
2. **Query the graph** for candidates using plain `graphify` CLI invocations — `graphify query "<intent>"`, `graphify path <from> <to>`, `graphify explain <symbol>`. Do **not** substitute any single harness's slash-command syntax; the rule reads correctly regardless of which harness loads it.
3. **Evaluate every candidate** the graph returns, including artifacts that are **unexported**, **incomplete**, or **not currently reachable from public surfaces** — they still count. A candidate you cannot import from outside the module is still a candidate to extend, not a reason to duplicate.
4. **Decide, transparently**:
   - **Identical or near-identical** → propose extending the existing artifact using the Refactor Proposal Format below. Do not silently duplicate.
   - **Borderline** (not clearly identical/near-identical, not clearly independent) — or extending the existing artifact would risk scope creep — → **stop and ask the operator**. Do not decide autonomously.
   - **Clearly independent** → author the new artifact; briefly note in the response which candidates you evaluated and why they did not match.

## Refuse-then-propose format

When you find a candidate to extend, respond with:

1. **Candidate location**: `file:line` for the existing artifact.
2. **Proposed signature** or shape of the extended artifact (the new capability, folded into the existing one).
3. **Estimated lines saved** vs. authoring a parallel implementation.
4. **One concrete call-site rewritten** as proof-of-concept before touching anything else — never a batch rewrite ahead of operator agreement.

Then wait for the operator to approve, redirect, or ask for more detail.

## Escape hatch (single session only)

The operator MAY suspend this rule for the current session with any natural-language request to that effect — e.g. "skip graphify check", "don't consult the graph this session", "authoring rule off for this task", or similar. Honor the intent, not a specific phrase. Suspension:

- applies only to the **current session** — it does not persist across sessions;
- must be **re-issued** in a new session if the operator wants it again;
- does not exempt you from noting in your response which artifacts you would have flagged had the rule been active.

## Tool-failure semantics (warn-and-proceed)

If a `graphify query`/`path`/`explain` invocation errors, times out, or returns garbage:

- **Warn** in the response: name the failed invocation and the outcome.
- **Proceed** with authoring rather than blocking on the failure.
- **Flag** the skipped consultation as an item to review manually later.

Blocking authoring on an auxiliary-tool failure would be a disproportionate operational risk — the same rationale the `post-commit` refresh hook uses to warn-and-continue on its own failures.

## Red-flag self-detection (adapted, harness-agnostic)

Treat these as strong signals that the rule is about to be violated:

- A new function name close to an existing one (`formatDate` vs. `formatDateString`, `retryOnce` vs. `retryWithBackoff`).
- The **third** date/retry/validation/error-handling utility in the codebase, especially with slightly different semantics each time.
- Ten or more lines copied from somewhere else "just to adapt slightly".
- The internal thought *"similar but different enough"* — this framing is almost always wrong; treat it as a trigger to query the graph, not as a decision.
- Starting to type `function helper(…)` without having checked the graph first.

When any of these fire, **stop** and run the consult step before proceeding.

## Test-fixture nuance

Duplicated **arrange/assert/setup** blocks across test cases are often intentional signal — each test's setup documents that test's assumptions in place, and consolidating them can obscure regressions. **Leave those alone.**

Helper **functions** that live inside test files, however, are subject to the same rule as any other named artifact: consult the graph, prefer extension over duplication.

## Interpreting graph output (thresholds)

Rough guidance, not hard cutoffs — operator judgment overrides:

- **≥6 identical lines with the same logic** across candidates → extract; propose the refactor.
- **<5 lines that are purely structural** (setup, error-wrapping, adapter boilerplate) → often OK to leave, don't over-extract.
- **Hits inside test files** → usually leave alone unless they are helper functions per the previous section.

## Freshness backstop (agent-side, independent of hooks)

FR-010 requires this rule's freshness guarantee to hold even when the `post-commit`, `post-merge` and `post-checkout` hooks are not installed or have been bypassed:

- **On a tracked branch, absent or incomplete graph** (`graphify-out/` or `graphify-out/graph.json` missing) → bootstrap with `graphify update <repo-root>` before authoring.
- **On a tracked branch, stale or unmarked graph** (missing/invalid `indexed_at_sha`, or marker ≠ `HEAD`) → refresh with `graphify update <repo-root>` before authoring.
- **On a feature branch/worktree, incomplete snapshot** → warn and continue with failed-consultation handling; do not run graphify against feature `HEAD`.
- **Fresh graph** or a **complete feature-branch snapshot** (intentionally frozen at fork point) → proceed to the consult step.

## Non-goals of this principle

- This principle does **not** rewrite existing duplicates already in the codebase — its scope is *new* authoring only.
- It does **not** replace human code review; borderline calls escalate to the operator, not to another agent.
- It does **not** require the graph to be complete or perfect — a stale-but-present graph is still useful, and the freshness backstop above bounds staleness on tracked branches.
