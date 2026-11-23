---
id: python-testing
kind: constitution_fragment
atom_source: python-testing
tags: [python, testing, unittest, unit-tests, integration-tests]
---
# Python testing best practices

When testing Python code:

- Test observable behavior and public contracts, not private implementation
  details. A refactor that preserves the contract should not require rewriting
  the tests.
- Use focused unit tests for pure logic and isolated components, integration
  tests for real module boundaries, and end-to-end tests only for workflows
  that need the complete system. Keep the test level visible in the test
  location and name according to the repository convention.
- Keep each test independent and deterministic. Avoid order dependence,
  shared mutable module state, real network services, the current time, and
  arbitrary sleeps. Use temporary directories, controlled clocks, seeded
  randomness, and explicit fakes or mocks at external boundaries.
- Exercise successful and failure behavior, especially malformed input,
  missing configuration, expected exceptions, authorization decisions,
  persistence failures, and resource cleanup. Assert the exception type and
  meaningful details without over-specifying incidental message formatting.
- Use `unittest` or the project's chosen test framework consistently. Fixtures
  should make setup and cleanup explicit; use context managers and framework
  cleanup hooks so a failing test cannot leak files, connections, processes, or
  patches into the next test.
- Keep mocks narrow and purposeful. Mock an external boundary when isolation
  or determinism requires it, but do not mock the code under test so heavily
  that the test only proves its own setup.
- For async code, test coroutines with the project's supported async test
  tooling. Do not call `asyncio.run()` inside an already-running event loop,
  and do not use sleeps to wait for concurrency. Test cancellation, timeout,
  cleanup, and ordering assumptions when they affect correctness.
- Keep parametrized cases focused and readable. Add a new case when it
  demonstrates a distinct boundary or regression; do not hide unrelated
  scenarios inside a large fixture or broad parameter matrix.
- Run the project's normal test and static-check commands. At minimum, make
  sure the test runner discovers the intended files and that a deliberately
  broken assertion makes the test fail during test development.

A passing test is evidence only for the behavior it actually exercises. Keep
tests easy to read, fast enough to run frequently, and honest about what they
do not cover.
