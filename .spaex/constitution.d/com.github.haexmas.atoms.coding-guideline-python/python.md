---
id: python
kind: constitution_fragment
atom_source: python
tags: [python, best-practices, typing, error-handling, testing]
---
# Python best practices

When working in a Python codebase:

- Follow the repository's supported Python versions and style configuration.
  Use the configured formatter, linter, type checker, and test runner instead
  of introducing competing project-wide tooling.
- Add type hints to public functions, methods, and meaningful data structures.
  Prefer precise types and protocols over `Any`; use `Any` only at a deliberate
  untyped boundary and narrow the value before it reaches domain logic. For
  supported Python versions, prefer modern built-in generics such as
  `list[str]` and `dict[str, int]`; use abstract collection types such as
  `Mapping` for read-only inputs when they describe the contract better.
- Model data explicitly. Use a small `dataclass`, `Enum`, or dedicated value
  object when a concept has invariants; do not pass a growing collection of
  positional tuples or unrelated dictionary keys through the application.
- Validate external input at the boundary and convert it to a domain shape
  once. Internal functions SHOULD be able to rely on their stated types and
  invariants rather than repeatedly defending against every possible input.
- Raise specific exceptions and catch only exceptions that can be handled at
  that layer. Do not use a bare `except`, catch `Exception` to hide a failure,
  or return `None` as an undocumented substitute for an error. Preserve the
  original cause with exception chaining when translating errors.
- Use context managers for resources such as files, locks, and transactions.
  Resource cleanup must not depend on reference counting, garbage collection,
  or a caller remembering a separate close operation.
- Prefer simple, readable control flow. Comprehensions are appropriate for
  small transformations; use a normal loop when conditions, side effects, or
  error handling would make the comprehension difficult to read. Avoid clever
  metaprogramming when ordinary functions and classes suffice.
- Keep async code non-blocking. Do not call blocking I/O or CPU-heavy work
  directly from an event loop; use an appropriate async API or explicitly move
  the work to a worker. Do not call `asyncio.run()` from code that may already
  be running inside an event loop.
- Prefer the standard library and existing project dependencies before adding
  a new package. Keep dependency additions justified by a real capability or
  maintenance benefit, not by a shorter one-off expression.
- For distributable projects, use `pyproject.toml` for build-system metadata,
  project metadata, dependencies, and tool configuration. Keep the declared
  Python version and dependency constraints explicit, and use the project's
  chosen environment or lock workflow consistently.
- Before handing off a change, run the project's formatter, linter, type
  checker, and relevant tests. When no project-specific commands exist, a
  reasonable baseline is `python -m compileall`, the configured test command,
  and the configured static checks; do not claim checks passed without running
  them.

Keep compatibility and import-time behavior in mind. Avoid expensive work,
network access, and surprising side effects at module import time unless the
project explicitly uses that pattern. At an application's top-level entry
point, `asyncio.run()` is appropriate; library code or code already inside an
event loop should expose or await a coroutine instead of starting a nested
event loop.
