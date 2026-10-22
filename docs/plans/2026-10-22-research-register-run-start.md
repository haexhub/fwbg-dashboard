# Research register: run start from the dashboard (fwbg register step 7)

Execution: task by task; each task gets a spec-compliance and a code-quality review.

**Goal:** fwbg gates every backtest run with its research register (a card per idea, every run
a counted trial, the holdout looked at once). Runs started from the dashboard are refused today:
the start modal and the AI chat's `start_run` tool send no `research_id`/`note`, the server proxy
aborts after 120 s while fwbg's preflight may take that long, and errors never reach the user.
This plan lets the user pick (or create) a card, write the note, optionally give a reason or ask
for a holdout look, and see refusals in plain text. Out of scope: register pages (card list,
detail, verdicts).

**fwbg contract (origin/develop):**
- `POST /api/runs/start` adds `research_id` (`S-NNNN`), `note` (non-empty, single line),
  `reason` (only for deliberate repeats; refusals `duplicate_fingerprint`, `holdout_repeat`),
  `holdout` (bool; a holdout look develops up to the card's cutoff and evaluates once after it,
  no `end_date`). The preflight takes up to 120 s. Refusal: 409 (any denial with status 409) or
  422 `{"detail": {"message", "denials": [{"code", "status", "message"}]}}`; preflight failure
  422 `{"detail": {"message", "output"}}`; timeout 504 `{"detail": "research preflight timed out"}`.
- `GET /api/research?status=&tag=` → `{"cards": [{id, title, status, tags, created,
  holdout_cutoff, trials, best, holdout_used, running} | {id, error}], "pending_error"}`.
- `POST /api/research` (`title`, `tags` ≥ 1, `hypothesis`, `mechanism`, all non-blank; optional
  `cutoff` ISO date) → 201 `{"card", "warning"?}`; a `warning` means written but not committed:
  never retry. Errors 409/422 with a string `detail`.
- A `no_edge` symbol's Sharpe is `null`.

**Decisions (operator, 2026-10-22):** run start plus a small "new card" form (no register
pages); the chat's `start_run` tool gets the research fields.

## Design

- **D1 proxy:** `fwbgFetch` errors carry fwbg's parsed JSON body as `data` (in addition to the
  current `statusMessage`), so the client reads structured `detail` instead of re-parsing a
  string; non-JSON bodies keep today's behaviour. New server routes `GET /api/research`
  (status/tag query passed through) and `POST /api/research`, validated with zod at the
  boundary. `POST /api/runs/start` validates its body with zod (strategy_name, assets,
  asset_classes, description, research_id `^S-\d{4}$`, note single-line non-blank, reason
  optional non-blank, holdout optional bool) and uses a 150 s timeout (preflight 120 s +
  margin, comment says why). Verify that the production server (nitro bun preset) does not cut a
  request that idles longer than 120 s; if it does, configure the preset's idle timeout and say
  so in the plan. Result: it does. The preset passes `NITRO_BUN_IDLE_TIMEOUT` to
  `Bun.serve({ idleTimeout })` and Bun's default is 10 s. Against the built server (Bun 1.3.13)
  a GET proxy slower than 10 s was cut ("request timed out after 10 seconds"); a POST with a
  body waited 15 s unharmed, but that is not documented behaviour. The Dockerfile sets
  `NITRO_BUN_IDLE_TIMEOUT=180` (above the 150 s fwbg timeout, below Bun's 255 s maximum).
- **D2 client:** `types/research.ts` (card summary, list entries as a union with the unreadable
  `{id, error}` entry, new card input/response, gate denial, run start body),
  `composables/useResearch.ts` (`listCards`, active by default; `createCard`). `useRuns.startRun`
  takes the typed body. One pure function, `utils/fetchErrorLines.ts` (auto-imported), turns a
  `$fetch` error into display lines. `err.data` is nitro's error envelope `{statusCode,
  statusMessage, message, data}`, so fwbg's body is at `err.data.data` and its refusal at
  `err.data.data.detail`: denials → `<code>: <message>` per denial, preflight failure →
  message and output lines, a text `detail` (504 timeout, 409 cancelled, 404 strategy) → that text. The
  dashboard's own 400 (`statusMessage: "Validation Error"`, `message` = zod's issues as JSON) →
  `<path>: <message>` per issue, or the message if it does not parse. Anything else → the
  existing error chain (`data.detail ?? data.message ?? statusMessage ?? message`, blank text
  skipped) and then the caller's fallback text.
- **D3 modal:** `RunStartModal.vue` gets a card select (active cards, label `S-NNNN · title`,
  required), a "Neue Karte" button opening `NewCardModal.vue` (title, tags, hypothesis,
  mechanism; optional cutoff) that selects the new card afterwards, a required single-line note,
  an optional reason, and a holdout checkbox with a one-line explanation. Start stays disabled
  until card and note are set. Errors show in an inline `UAlert` (the denial lines), the modal
  stays open. A card `warning` shows as a toast, the id is used anyway. Match the existing UI
  language of the modal and the pattern of `components/agents/ResearchBriefModal.vue`.
- **D4 chat tool:** `server/api/ai/chat.post.ts` `start_run`: zod schema adds `research_id`
  (regex), `note`, optional `reason`, optional `holdout`; tool description tells the model to ask
  the user for card and note when unknown; 150 s timeout; a refusal returns the readable denial
  lines as the tool error.
- **D5 null Sharpe:** `types/grid-detail.ts` `sharpe?: number | null`; `useRunPerformance` must
  not replace fwbg's `null` (no edge) by a Sharpe computed in the frontend: show "kein Edge"/
  "–" where the value is displayed; fix any formatter that would throw on `null`.

## Tasks

1. Server: `fwbgFetch` error data, research routes, start route validation + timeout (+ bun idle
   timeout check). Tests for the error shape and the zod validation (vitest, node).
   Commit `feat(server): proxy the research register and validate run starts`.
2. Client: types, `useResearch`, typed `startRun`, error-lines function with unit tests.
   Commit `feat(runs): research types and gate error lines`.
3. UI: `RunStartModal` fields, `NewCardModal`, error display. Commit
   `feat(runs): start runs with a research card`.
4. Chat tool. Commit `fix(ai): start_run sends research fields`.
5. Null Sharpe. Commit `fix(performance): show no edge for a null sharpe`.

Final: `bun run nuxi typecheck`, `bun run test:run`, `bun run build`; whole-branch review. Both
repos are public: no data from the private research register (card contents, real ids) in code,
docs, tests or commits.
