---
id: ast-grep-structural-search
kind: constitution_fragment
atom_source: ast-grep-structural-search
tags: [ast-grep, structural-search, refactoring, context]
---
# Capability: structural search with ast-grep

**Status**: Opt-in through molecule `com.github.haexmas.atoms.ast-grep`.
**Applies to**: agents that need syntax-aware search or rewrite operations.

## Rule

When a search or rewrite depends on code structure rather than exact text, the
agent SHOULD use `ast-grep` (or its `sg` executable) instead of a broad regular
expression or text replacement. Typical cases include matching a call shape,
finding a particular declaration form, or changing a syntax pattern across
several files.

`ast-grep` is a precision tool, not the project's source of architectural
truth. When the task is about locating the correct domain artifact, consult
graphify first; use `ast-grep` afterward to enumerate or validate structurally
matching code.

## Operating protocol

1. Check whether `ast-grep` or `sg` is available before relying on it.
2. Restrict the search to the smallest relevant language and path scope.
3. Keep the result bounded and inspect representative matches before proposing
   a rewrite.
4. For rewrites, show or review the complete match set, run the relevant tests,
   and do not apply a blanket change merely because the pattern matches.
5. If the executable is unavailable, report that fact and fall back to a
   carefully scoped `rg` search. Do not install a package automatically and do
   not make adoption of this molecule fail solely because the optional tool is
   absent.

Useful examples:

```text
ast-grep --pattern '<code pattern with $META variables>' --lang <language> <path>
ast-grep --pattern '<old syntax>' --rewrite '<new syntax>' --lang <language> <path>
```

The upstream project and language-specific pattern syntax are documented at
<https://github.com/ast-grep/ast-grep>.
