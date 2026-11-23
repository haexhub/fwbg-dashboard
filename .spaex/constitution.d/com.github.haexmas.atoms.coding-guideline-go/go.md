---
id: go
kind: constitution_fragment
atom_source: go
tags: [go, best-practices, errors, concurrency, context]
---
# Go best practices

When working in a Go codebase:

- Let the toolchain settle style questions. Code MUST be `gofmt`-formatted
  (or `goimports`-formatted where the project uses it). Do not hand-format
  against the tool and do not reformat unrelated code in the same change.
- Handle errors explicitly. Return an error for any recoverable failure and
  do not use `panic` for expected conditions such as bad input, missing files,
  or network failures. Reserve `panic` for programmer errors and impossible
  states.
- Add context when an error crosses a boundary, using
  `fmt.Errorf("doing x: %w", err)` so callers can still use `errors.Is` and
  `errors.As`. Handle an error once: either return it or log it, not both.
  Keep error strings lowercase and without trailing punctuation. Introduce a
  sentinel error or a custom error type only when a caller needs to tell the
  cases apart.
- Pass `context.Context` as the first parameter of any function that does I/O,
  blocks, or may run long, and name it `ctx`. Do not store a context in a
  struct, do not pass `nil`, and always call the `cancel` function returned by
  `context.WithCancel`, `WithTimeout`, or `WithDeadline` (usually with
  `defer`). Honor cancellation in loops and blocking calls.
- Accept interfaces and return concrete types. Define an interface in the
  package that consumes it, keep it small, and do not add an interface before
  there is a second implementation or a concrete need to substitute one in a
  test.
- Make the zero value useful where practical. Avoid `init()` functions and
  mutable package-level state; pass dependencies explicitly through
  constructors or parameters. Use functional options only when a constructor
  has several genuinely optional settings.
- Never start a goroutine without knowing how and when it ends. The code that
  starts it owns its lifetime: wait for it with `sync.WaitGroup` or
  `errgroup`, stop it through a context, and let the sole sender, or an owner
  that coordinates all senders, close a channel, never the receiver. Protect
  shared mutable state with a mutex or confine it to one goroutine. Do not rely
  on a loop variable's per-iteration semantics unless `go.mod` declares a Go
  version that guarantees them.
- Keep packages small and named for what they provide: short, lowercase, and
  without underscores. Avoid catch-all names such as `util` or `common`, and
  avoid stutter such as `user.UserService`. Put code that must not be imported
  from outside the module under `internal/`. Follow the repository's existing
  layout, for example `cmd/<binary>` for entry points, instead of introducing
  a new one.
- Close resources deliberately. `defer` the `Close` of readers right after the
  successful open. For writers and files that were written to, check the error
  returned by `Close` or `Flush`, because it can be the only sign of a failed
  write.
- Run external programs without a shell. Use `exec.CommandContext` with the
  command and each argument as separate values; do not build a command line by
  string concatenation or pass untrusted input through `sh -c`. Validate and
  constrain paths and identifiers at the boundary before they reach a command
  or the filesystem.
- Use `log/slog` for structured logging when the project does not already
  standardize on another logger. Do not log secrets, and do not use logging as
  a substitute for returning an error.
- Prefer the standard library and keep the dependency set small. Add a module
  only for a concrete need, and keep `go.mod` and `go.sum` consistent with
  `go mod tidy`. Use generics only where they remove real duplication; a plain
  function or interface is usually clearer.
- Before handing off a change, verify that `gofmt -l .` prints no files, then
  run `go vet ./...` and `go test ./...` when the project supports those
  commands. Add `-race` for code with concurrency. Run `golangci-lint run` and
  `govulncheck ./...` when the project configures them, and follow documented
  command variants when they differ.

Choose the smallest correct implementation that fits the existing module's
conventions. Do not introduce a new dependency, abstraction layer, or
concurrency pattern without a concrete problem that the existing code cannot
solve.
