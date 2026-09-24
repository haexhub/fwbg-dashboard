---
id: javascript-typescript-testing
kind: constitution_fragment
atom_source: javascript-typescript-testing
tags: [javascript, typescript, testing, unit-tests, integration-tests]
---
# JavaScript and TypeScript testing best practices

When testing JavaScript or TypeScript code:

- Test observable behavior and public contracts, not the exact arrangement of
  private functions or implementation details. A refactor that preserves the
  contract should not require rewriting the test suite.
- Choose the narrowest test level that proves the behavior: unit tests for
  pure logic, integration tests for module boundaries and persistence, and
  end-to-end tests for critical user journeys. Do not turn every test into a
  slow end-to-end test.
- Keep tests deterministic and isolated. Avoid real network calls, shared
  mutable state, random values without a controlled seed, and arbitrary timer
  sleeps. Control time, randomness, environment, and external clients at
  explicit boundaries.
- Test both successful and failure behavior, including malformed input,
  missing values, rejected promises, cancellation or timeout behavior, and
  authorization or persistence failures where they matter.
- Await every promise that affects the assertion. Do not leave floating
  promises in tests, and do not let a test pass before the asynchronous work
  it is meant to verify has completed. Use `Promise.all` or
  `Promise.allSettled` when the test intentionally exercises concurrent work
  and its failure semantics.
- Keep mocks narrow and behavior-oriented. Mock an external boundary when
  isolation or determinism requires it, but do not mock the unit's own logic
  so thoroughly that the test only verifies the mock wiring.
- For TypeScript, keep type-level tests separate from runtime tests when the
  project needs to verify inference, assignability, or declaration output.
  Runtime tests cannot prove a compile-time contract, and the compiler cannot
  prove runtime validation of external data.
- Use the repository's configured runner, environment, formatter, linter, and
  compiler. A change should include relevant tests and pass the project's
  normal test command; do not assume that a test file is discovered unless the
  runner configuration confirms it.

Prefer a small number of clear assertions per scenario over a large fixture
that hides what the test is proving. Test names should describe the behavior
and relevant condition, not the implementation method name alone.
