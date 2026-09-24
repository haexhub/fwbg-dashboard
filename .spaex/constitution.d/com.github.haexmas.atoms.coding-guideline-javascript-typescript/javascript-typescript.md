---
id: javascript-typescript
kind: constitution_fragment
atom_source: javascript-typescript
tags: [javascript, typescript, best-practices, type-safety, async]
---
# JavaScript and TypeScript best practices

When working in a JavaScript or TypeScript codebase:

- Treat TypeScript's `strict` mode as the baseline for new or actively
  maintained TypeScript code. Existing projects MAY opt out of individual
  strict checks during migration, but should make that choice explicit. Avoid
  `any`; use a precise type, a generic, or `unknown` followed by explicit
  narrowing. Keep untyped escape hatches local and explain why they are
  necessary.
- Validate data at trust boundaries: HTTP responses, request bodies, files,
  environment variables, message queues, and browser storage are not made
  safe by a TypeScript type assertion. Assertions have no runtime effect.
  Parse or validate the data once, then pass the resulting domain type inward.
- Prefer `const` and narrow local mutation. Use `let` when reassignment makes
  the state transition clearer; do not use mutation or shared mutable module
  state as an accidental communication channel.
- Use `===`/`!==`, `??`, and `?.` deliberately. Do not use `||` when a valid
  value such as `0`, `false`, or `""` must be preserved, and do not hide a
  required value behind optional chaining without deciding how absence is
  handled.
- Keep asynchronous control flow explicit. `await` promises whose result or
  failure matters, handle errors at the boundary that can recover or report
  them, and use `Promise.all` only when operations are independent and
  fail-fast behavior is acceptable. Do not leave promises unhandled.
- Preserve error causes when translating errors. Add useful context at a
  boundary, but do not catch an error merely to log and rethrow it unchanged;
  that usually duplicates logs and loses ownership of the failure decision.
- Keep modules and exports focused. Prefer named exports for reusable library
  code, avoid circular dependencies, and do not introduce a barrel export or
  a new abstraction only to shorten an import path.
- Prefer immutable transformations at shared boundaries, but allow simple
  local mutation when it is clearer and measurably avoids needless allocation.
  Readability and correct ownership of state matter more than a blanket
  immutability rule.
- Use the project's configured formatter, linter, compiler, and test runner.
  At minimum, TypeScript changes SHOULD pass `tsc --noEmit` (or the project's
  equivalent), linting, formatting checks, and the relevant tests. Do not
  replace repository tooling with a personal global installation.

Follow the existing runtime and module-system conventions. Browser, Node.js,
and serverless environments have different APIs and failure modes; do not
assume that a platform-specific global or API exists everywhere.
