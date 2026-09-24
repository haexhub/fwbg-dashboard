---
id: general-coding
kind: constitution_fragment
atom_source: general-coding
tags: [coding, maintainability, architecture, code-review, testing]
---
# General coding best practices

When working in any codebase, optimize for code that another developer can
understand, verify, change, and remove safely.

## Make changes in repository-local worktrees

- For any existing Git repository, all changes MUST be authored in a dedicated
  repository-local worktree on a topic branch. This applies to source code,
  tests, documentation, configuration, and generated files that are part of
  the change.
- A repository-local worktree is a directory registered for the target
  repository by `git worktree list`. A copied directory or an unrelated clone
  does not satisfy this requirement.
- Before the first edit, verify the repository root, the active branch, and
  the registered worktrees. If no suitable worktree exists, create one before
  modifying files.
- Keep the primary checkout reserved for inspection and worktree management;
  do not author changes there. Read-only inspection of any checkout is fine.
- Keep each task isolated in its own worktree and topic branch so that changes
  can be reviewed, tested, committed, and removed independently.

## Lines of code are a signal, not a rule

- Do not enforce a universal maximum for functions, files, or pull requests.
  Domain complexity, cohesion, control flow, and the number of reasons to
  change are more meaningful than a line count.
- Treat 500 LoC as the upper boundary for hand-maintained source files. A file
  that is clearly over 500 LoC MUST be split or have an explicit, documented
  reason to remain large together with a concrete plan for a later split. The
  boundary is a maintainability constraint, not a target; do not pad files up
  to 500 lines. Generated files, vendored code, snapshots, and other files not
  normally edited by hand MAY exceed it, but should be excluded from this
  assessment.
- Use smaller soft thresholds as prompts for review, not as automatic failures.
  A function or method beyond roughly 40–60 lines, or nesting deeper than
  roughly three levels, deserves a deliberate look: is it still one coherent
  unit, or are there distinct responsibilities to name and separate? These
  thresholds are heuristics, not targets or mandatory limits.
- Treat a change of about 100 net lines as a useful review-size warning and a
  change approaching 1000 lines as a strong prompt to split the work or agree
  on the larger change in advance. Generated code, mechanical renames, and
  required migrations are legitimate exceptions, but should be identified as
  such.
- Never add artificial wrappers, blank lines, or extra files only to satisfy a
  line-count threshold. A short but tangled module is not healthy, and a long
  but cohesive module is not automatically wrong.

## Functions and responsibilities

- Give each function one coherent responsibility at one level of abstraction.
  Extract a helper when it gives a meaningful name to a concept, makes a
  branch independently testable, or removes repeated logic—not merely because
  the function crossed an arbitrary line count.
- Prefer early returns or named helpers when they make the main path easier to
  follow. Reduce nesting, but do not scatter one simple operation across many
  microscopic functions.
- Keep side effects at visible boundaries. Pure calculations and decisions
  should be easy to test without a database, network, filesystem, clock, or
  global mutable state.
- Name code after its domain meaning and behavior. A clear name is better than
  a comment that explains an otherwise opaque `data`, `helper`, or `process`
  function.

## Files, modules, and directories

- Organize code around cohesive domain or feature boundaries where the
  codebase supports it. Do not create folders only for superficial symmetry
  such as putting every small class, interface, or helper in its own folder.
- A file SHOULD have one primary reason to change. Split a file when it has
  unrelated responsibilities, independent public concepts, different change
  owners, or tests that are difficult to isolate. Do not split solely to make
  files shorter.
- Keep public module interfaces narrow and intentional. Hide implementation
  details behind the smallest stable API the callers need; avoid re-exporting
  everything or creating pass-through modules that add no boundary.
- Keep dependencies directed and understandable. Avoid circular imports,
  hidden global state, and a domain layer that knows about infrastructure
  details. Put I/O, framework adapters, and process wiring at the edges when
  the architecture calls for such a separation.
- Keep related tests close to the behavior they verify according to the
  language and repository convention. A module split is not complete if its
  tests, documentation, fixtures, and call sites are left misleadingly
  behind.
- Test code MUST be maintained in files separate from production code in every
  language. This applies to unit, integration, contract, and end-to-end tests.
  A language-required test-module declaration or registration may remain in
  the production file, but test bodies and test-only helpers MUST live in
  dedicated test files. Do not place inline test modules or test functions in
  production files. Follow the repository's convention for test-file placement
  and naming.

## Duplication, abstraction, and comments

- Do not abstract two things merely because they look similar. First establish
  that they have the same behavior, ownership, change reason, and invariants.
  A small amount of local duplication is preferable to a premature generic
  abstraction that couples unrelated callers.
- Refactor repeated behavior when the shared rule is real and the abstraction
  makes both callers clearer. Keep the abstraction close to the domain that
  owns it; avoid a generic utility module becoming a dumping ground.
- Comments SHOULD explain why a non-obvious decision exists, what invariant
  must be preserved, or which external constraint applies. Do not use
  comments to narrate code that could be made clear through structure and
  naming. Update comments when the behavior changes.
- Separate broad formatting or mechanical refactors from behavior changes
  when possible. Mixed diffs make review, debugging, rollback, and blame less
  reliable.

## Agent attribution and self-reference

- LLM agents MUST NOT leave references to themselves, their model, runtime,
  role, prompts, or participation in project artifacts. This includes commit
  messages, commit trailers such as `Co-authored-by`, source and documentation
  comments, changelogs, generated content, metadata, and other repository
  content.

## Tests, review, and completion

- Add or update tests with behavior changes. Test observable behavior and
  important failure modes, not private implementation details. A test is
  useful only when it can fail for a real regression.
- Keep each change self-contained and easy to review: production code,
  relevant tests, documentation, and configuration belong together when they
  describe the same behavior. Split independent refactors and unrelated
  cleanups into separate changes.
- Before handoff, run the repository's formatter, static checks, and relevant
  tests. Report what was run and any checks that were unavailable or skipped;
  do not turn a green-looking diff into an unverified claim.
- Prefer a change that clearly improves maintainability and correctness over
  theoretical perfection. When a design is uncertain, make the smallest
  reversible change that provides evidence about the next decision.

When a repository already has a documented structure, naming scheme, or size
convention, follow it unless the task explicitly changes that convention. This
atom supplies defaults, not a reason to reformat or reorganize an entire
codebase.
