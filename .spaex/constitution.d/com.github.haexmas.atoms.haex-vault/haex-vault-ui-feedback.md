---
id: haex-vault-ui-feedback
kind: constitution_fragment
atom_source: haex-vault-ui-feedback
tags: [haex-vault, ui, settings, toast, feedback, errors]
---

# Capability: give feedback in haex-vault's UI without inline status lines

**Status**: Part of molecule `com.github.haexmas.atoms.haex-vault`.
**Applies to**: agents that write or change user-facing components, pages, dialogs or settings in
a haex-vault checkout or worktree.

## Rule

haex-vault's operator decided (2026-11-03 and 2026-11-04) that success and error messages appear only
as toasts, so they look the same everywhere. A component never reports the outcome of an action
with text inside itself. The visible state is the confirmation; a failure is a toast.

- A setting MUST apply on selection, without a save or apply button and without a confirmation
  such as "Gespeichert."; a button that resets to the default is fine.
- A component, card, row or dialog MUST NOT show a success message inside itself after an action
  (for example "Gespeichert.", "Modelle aktualisiert.", "Verbunden."), and a button MUST NOT
  switch its label to one ("Kopiert"). The changed state the user sees is the confirmation. Only
  when the outcome is visible nowhere else, such as a copy, a passed connection test or a file
  written by an export, MAY it show as a success toast (`toast.success` from `vue-sonner`). An
  icon on a button MAY change to show its state (a copy icon turning into a check mark).
- An error of a load, a save or any other action MUST show as a toast (`toast.error` from
  `vue-sonner`), in pages and dialogs alike, never as an inline `text-destructive` or
  `role="alert"` line. The only inline error is a wrong input, directly under its field.
- An error that ends a flow and offers actions (retry, reload the model, try another source)
  MUST show its message as a toast; its buttons MUST stay in the component, without a message
  line, for as long as the error lasts.
- A standing state that is not the result of the last action is not a message and MAY stay
  inline: a confirmation question (install an older version, download despite too little space,
  trust a changed host key), a denied permission with the way to allow it, an insecure-source
  warning, missing credentials, an entry deleted on another device, or the stored status of a
  background run.

## Operating protocol

1. Before adding text that appears after an action, ask whether the UI already shows the new
   state. If it does, add nothing; if it does not, and only then, use a success toast.
2. Route every caught action error to `toast.error(...)` with the localized message. Keep a
   boolean only where the failure also changes what the page renders (an empty-state notice that
   must not claim "no entries" after a failed load).
3. A wrong input shows directly under the input field it concerns, while the user types, and
   disappears once the value is valid.
4. Toast each new error once: give a toast a fixed `id` when several open windows or tabs watch
   the same store error, and do not toast a stored status again on every render.
5. End-to-end tests read error toasts with the shared helper (`scripts/e2e/lib/toasts.ts`) and
   check a saved value by reading it back, not by waiting for a confirmation line.
6. When a component imports `vue-sonner` and is loaded by `scripts/lib/script-setup-sandbox.ts`
   in a Node check, give the check a `'vue-sonner'` import double.
