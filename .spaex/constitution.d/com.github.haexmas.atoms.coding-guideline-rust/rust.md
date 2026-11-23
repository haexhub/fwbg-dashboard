---
id: rust
kind: constitution_fragment
atom_source: rust
tags: [rust, best-practices, ownership, error-handling, testing]
---
# Rust best practices

When working in a Rust codebase:

- Prefer types that make invalid states unrepresentable. Use enums for a
  closed set of states and `Option<T>` for an explicitly optional value; do
  not encode either as sentinel values or loosely related booleans.
- Respect ownership instead of fighting it. Borrow when the callee does not
  need ownership, return owned data when the result must outlive the input,
  and do not add `.clone()` merely to silence the borrow checker. A clone is
  fine when it expresses a real ownership boundary or is demonstrably the
  clearest and sufficiently cheap choice.
- Use `Result<T, E>` for recoverable failures and propagate errors with `?`.
  Add context at a boundary where it helps the caller understand what failed;
  do not discard the original error or replace it with an uninformative
  string.
- Do not use `unwrap()` or `expect()` on data, I/O, configuration, or network
  input. They MAY be used when an invariant is local, explicit, and genuinely
  impossible to violate; document that invariant at the call site.
- Keep unsafe code isolated and justified. Prefer a safe abstraction around a
  small unsafe block, document the safety argument, and add a test that would
  expose a violation of the assumed invariant.
- Prefer iterators and combinators when they make the transformation clearer,
  but use an ordinary loop when it communicates control flow or error handling
  better. Idiomatic syntax is not a reason to make code harder to read.
- Keep async code non-blocking. Do not perform blocking file, process, or
  CPU-heavy work directly on an async executor thread; use the runtime's
  blocking facility or a dedicated worker where appropriate. Do not create a
  new runtime inside an already-running async context.
- Keep public APIs narrow and document public items when the crate's lint
  policy requires it. Avoid exposing implementation details solely to work
  around a local borrow or lifetime problem.
- Before handing off a change, run `cargo fmt --check`, `cargo check`,
  `cargo clippy`, and `cargo test` when the project supports those commands.
  Respect the repository's configured Clippy lint levels; enable stricter
  categories or `-D warnings` only when the project deliberately requires
  them. Follow documented command variants when they differ.

Choose the smallest correct implementation that fits the existing crate
conventions. Do not introduce a new crate, abstraction, or async strategy
without a concrete problem that the existing code cannot solve.
