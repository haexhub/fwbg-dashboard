---
id: rust-testing
kind: constitution_fragment
atom_source: rust-testing
tags: [rust, testing, unit-tests, integration-tests, doctests]
---
# Rust testing best practices

When testing a Rust codebase:

- Test behavior and contracts, including important failure paths, rather than
  mirroring private implementation details. A test should fail when the
  promised behavior regresses.
- Put focused unit-test implementations in dedicated files separate from
  production code. For module-private unit tests, a small declaration such as
  `#[cfg(test)] mod tests;` may remain in the module under test, with the test
  implementation in the separate test file. Use integration tests under
  `tests/` to exercise the public API as an external consumer would. Use
  documentation tests for public examples that should compile and remain
  correct.
- Keep tests deterministic and isolated. Do not depend on test order, shared
  mutable state, wall-clock timing, network services, or a developer-specific
  filesystem. Inject clocks, ports, and external clients where the behavior
  needs control.
- Cover boundaries and failure behavior deliberately: empty and malformed
  input, relevant limits, authorization decisions, persistence failures, and
  cancellation or concurrency behavior where applicable. Do not chase a
  coverage percentage at the expense of meaningful assertions.
- Prefer explicit assertions with useful failure context. Avoid weakening a
  production invariant merely to make a test convenient; make the fixture
  satisfy the same contract as a real caller.
- For async code, use the async test support of the runtime already used by
  the project. Test cancellation, timeout, and ordering assumptions when they
  affect correctness; do not use arbitrary sleeps to wait for a task.
- Keep test helpers small and local to the tests that own them. A shared
  fixture is justified when it expresses a stable domain setup, not merely to
  remove a few repeated lines.
- Run `cargo test` for the complete package or workspace as appropriate. This
  includes unit, integration, and library documentation tests by default;
  follow project-specific feature, target, and test-runner requirements too.

A test suite is production code: keep it readable, fast enough to run often,
and trustworthy when it passes.
