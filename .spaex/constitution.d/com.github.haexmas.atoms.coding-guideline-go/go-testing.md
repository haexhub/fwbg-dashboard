---
id: go-testing
kind: constitution_fragment
atom_source: go-testing
tags: [go, testing, table-driven, race-detector, fuzzing]
---
# Go testing best practices

When testing a Go codebase:

- Test behavior and contracts, including important failure paths, rather than
  mirroring private implementation details. A test should fail when the
  promised behavior regresses.
- Keep tests in `_test.go` files next to the code they cover. Use the external
  `<package>_test` package to exercise the public API as a consumer would, and
  the internal package only when a unit genuinely needs unexported access.
- Use table-driven tests with `t.Run` subtests when several inputs share one
  behavior. Give each case a descriptive name and a clear expected result, and
  do not force unrelated scenarios into one table.
- Keep tests deterministic and isolated. Do not depend on test order, shared
  mutable state, wall-clock timing, network services, or a developer-specific
  filesystem. Inject clocks, ports, and external clients where the behavior
  needs control, and do not use arbitrary `time.Sleep` calls to wait for a
  goroutine; synchronize with channels, contexts, or the testing support that
  the project's Go version provides.
- Use the helpers of the `testing` package: `t.Helper()` in assertion helpers,
  `t.Cleanup` for teardown, `t.TempDir()` for files, and `t.Setenv` for
  environment variables. Do not combine `t.Setenv` with `t.Parallel()` because
  environment variables are process-global. Call `t.Parallel()` only for tests
  that share no state.
- Prefer small hand-written fakes over generated mocks. For HTTP use
  `net/http/httptest`. For code that runs external programs, hide the runner
  behind a small interface that a test can replace, so tests do not execute
  real system commands such as disk or network tools.
- Compare results with clear failure messages that show both the got and the
  want value. Use `cmp.Diff` from `go-cmp` for structured values and the
  assertion library only when the project already uses one. Store larger
  expected outputs as golden files under `testdata/`.
- Cover boundaries and failure behavior deliberately: empty and malformed
  input, relevant limits, authorization decisions, I/O failures, and
  cancellation or timeout behavior where applicable. Do not chase a coverage
  percentage at the expense of meaningful assertions.
- Run the race detector for code that uses goroutines, channels, or shared
  state, and treat a reported race as a defect. Add a fuzz test for parsers and
  decoders that process untrusted input. Add benchmarks only for code whose
  performance has been measured to matter.
- Run `go test ./...` for the complete module as appropriate, with `-race`
  for concurrent code. Use `-count=1` to bypass the test cache when a result
  may depend on external state, and follow project-specific tags, build
  constraints, and test-runner requirements too.

A test suite is production code: keep it readable, fast enough to run often,
and trustworthy when it passes.
