# Researcher Event Persistence

**Status:** Planned — dashboard side done (branch `feat/research-cancel-retry`), fwbg-agents side pending.

## Problem

`research_search` and `research_results` SSE events are fire-and-forget. When the dashboard page is opened after researcher runs have already started, all historical search queries and result URLs are invisible. The dashboard can only show live progress if the SSE connection was established before the runs fired those events.

## Solution

Store researcher events in the fwbg-agents DB and expose a REST endpoint for the dashboard to backfill on page load.

---

## fwbg-agents changes

### 1. DB table: `agent_run_events`

```sql
CREATE TABLE agent_run_events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id      INTEGER NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
    type        TEXT    NOT NULL,   -- 'research_search' | 'research_results'
    payload     TEXT    NOT NULL,   -- JSON blob of the full event
    ts          TEXT    NOT NULL    -- ISO-8601 timestamp
);
CREATE INDEX idx_agent_run_events_run_id ON agent_run_events(run_id);
```

### 2. Persist events when they fire

In `researcher.py` (or wherever `research_search` / `research_results` are emitted), write a row to `agent_run_events` immediately after emitting the SSE event. The `payload` column stores the same JSON dict that goes to the SSE stream.

### 3. New endpoint: `GET /agents/runs/{run_id}/events`

```python
@router.get("/agents/runs/{run_id}/events")
async def get_run_events(run_id: int, db: Session = Depends(get_db)):
    rows = db.query(AgentRunEvent).filter_by(run_id=run_id).order_by(AgentRunEvent.ts).all()
    return [json.loads(r.payload) for r in rows]
```

Returns `[]` (empty list) if the run exists but has no stored events. Returns `404` if the run does not exist.

---

## Dashboard side (already done)

- `server/api/agents/runs/[id]/events.get.ts` — proxy endpoint, gracefully passes through 404
- `ActiveRunsCard.vue` — on each `fetchRuns()` call, calls `backfillRunEvents(runId)` for every active `researcher` run (idempotent: skips already-backfilled IDs). Silently ignores errors so the card stays functional before the backend endpoint ships.

---

## Rollout order

1. Merge dashboard branch (`feat/research-cancel-retry`) → fwbg-dashboard develop
2. Land fwbg-agents DB migration + endpoint → fwbg-agents develop
3. Release together or separately — dashboard degrades gracefully without the backend endpoint
