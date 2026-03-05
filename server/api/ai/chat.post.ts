/**
 * POST /api/ai/chat
 *
 * SSE streaming endpoint. Accepts a messages array, runs the Claude
 * agentic loop with FWBG tools, and streams events to the client.
 *
 * Request body: { messages: Anthropic.MessageParam[] }
 *
 * Stream events (JSON lines prefixed with "data: "):
 *   { type: "text",       content: string }
 *   { type: "tool_start", name: string, input: object }
 *   { type: "tool_done",  name: string }
 *   { type: "tool_error", name: string, error: string }
 *   { type: "done" }
 *   { type: "error",      message: string }
 */

import Anthropic from "@anthropic-ai/sdk";

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const FWBG_TOOLS: Anthropic.Tool[] = [
  {
    name: "list_strategies",
    description: "List all available strategy configs. Returns filename, name, description, tags.",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "get_strategy",
    description:
      "Load a strategy config by filename (without .json). Returns full config with resolved preset references and a _refs key preserving original preset names.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Strategy filename without .json extension" },
      },
      required: ["name"],
    },
  },
  {
    name: "save_strategy",
    description:
      "Create or update a strategy config. Call this to persist changes before starting a run. " +
      "Important: always include signal_rules when creating ML strategy configs – " +
      "without them the model sees all bars and produces 0 OOS trades.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Strategy filename without .json" },
        config: { type: "object", description: "Full strategy configuration" },
      },
      required: ["name", "config"],
    },
  },
  {
    name: "start_run",
    description:
      "Start a strategy optimization run in the background. Returns run_id immediately. " +
      "Use get_run_status to track progress.",
    input_schema: {
      type: "object" as const,
      properties: {
        strategy_name: { type: "string" },
        assets: {
          type: "array",
          items: { type: "string" },
          description: "Optional asset filter override, e.g. ['NAS100', 'DAX']",
        },
        description: { type: "string", description: "Optional note for this run" },
      },
      required: ["strategy_name"],
    },
  },
  {
    name: "get_run_status",
    description:
      "Get current status and progress of a run. Returns status (running/completed/failed), " +
      "progress_fraction, current_stage.",
    input_schema: {
      type: "object" as const,
      properties: { run_id: { type: "string" } },
      required: ["run_id"],
    },
  },
  {
    name: "get_run_results",
    description:
      "Get full results for a completed run: summary KPIs, per-asset PF/WR/CAGR/max_drawdown, " +
      "fold stability, walk-forward breakdown. Only call for completed runs.",
    input_schema: {
      type: "object" as const,
      properties: { run_id: { type: "string" } },
      required: ["run_id"],
    },
  },
  {
    name: "get_run_logs",
    description:
      "Get structured logs for a run. Use level='error' or level='info' to filter noise.",
    input_schema: {
      type: "object" as const,
      properties: {
        run_id: { type: "string" },
        level: {
          type: "string",
          enum: ["info", "debug", "warning", "error"],
          description: "Optional level filter",
        },
        limit: { type: "integer", description: "Max entries (default 100)" },
      },
      required: ["run_id"],
    },
  },
  {
    name: "list_recent_runs",
    description: "List recent runs with their status and outcome summary.",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: { type: "integer", description: "Number of runs (default 10)" },
        strategy: { type: "string", description: "Optional strategy name filter (substring)" },
      },
    },
  },
  {
    name: "list_indicators",
    description:
      "List all available indicator plugins with signal_columns (use these in signal_rules) " +
      "and feature_columns.",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "get_indicator_schema",
    description:
      "Get full param schema for an indicator: types, defaults, signal/feature columns. " +
      "Use the signal_columns in signal_rules to pre-filter bars for the ML model.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description: "Short name like 'opening_range' or fqn like 'fwbg-core:opening_range'",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "list_exit_strategies",
    description:
      "List all available exit strategy plugins with param schema. " +
      "Key params: tp_mult (TP as ATR multiple), sl_mult (SL as ATR multiple), timeout_bars.",
    input_schema: { type: "object" as const, properties: {} },
  },
];

// ---------------------------------------------------------------------------
// Tool executor
// ---------------------------------------------------------------------------

async function executeTool(
  name: string,
  input: Record<string, unknown>,
  fwbgApiUrl: string
): Promise<string> {
  const apiFetch = async (path: string) => {
    const res = await fetch(`${fwbgApiUrl}${path}`, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    return res.json();
  };
  const apiPut = async (path: string, body: unknown) => {
    const res = await fetch(`${fwbgApiUrl}${path}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    return res.json();
  };
  const apiPost = async (path: string, body: unknown) => {
    const res = await fetch(`${fwbgApiUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    return res.json();
  };

  switch (name) {
    case "list_strategies":
      return JSON.stringify(await apiFetch("/api/strategies"));

    case "get_strategy":
      return JSON.stringify(await apiFetch(`/api/strategies/${input.name}`));

    case "save_strategy":
      return JSON.stringify(await apiPut(`/api/strategies/${input.name}`, input.config));

    case "start_run": {
      const body: Record<string, unknown> = { strategy_name: input.strategy_name };
      if (input.assets) body.assets = input.assets;
      if (input.description) body.description = input.description;
      return JSON.stringify(await apiPost("/api/runs/start", body));
    }

    case "get_run_status":
      return JSON.stringify(await apiFetch(`/api/runs/${input.run_id}/progress`));

    case "get_run_results": {
      const run = await apiFetch(`/api/runs/${input.run_id}`);
      try {
        const assets = (await apiFetch(`/api/runs/${input.run_id}/grid_details`)) as string[];
        const details: Record<string, unknown> = {};
        for (const asset of assets) {
          details[asset] = await apiFetch(`/api/runs/${input.run_id}/grid_details/${asset}`);
        }
        (run as Record<string, unknown>).grid_details = details;
      } catch {
        // grid_details may not exist for running runs
      }
      return JSON.stringify(run);
    }

    case "get_run_logs": {
      const params = new URLSearchParams();
      if (input.level) params.set("level", String(input.level));
      params.set("limit", String(input.limit ?? 100));
      return JSON.stringify(await apiFetch(`/api/runs/${input.run_id}/logs?${params}`));
    }

    case "list_recent_runs": {
      const params = new URLSearchParams();
      params.set("limit", String(input.limit ?? 10));
      const result = (await apiFetch(`/api/runs?${params}`)) as {
        items?: unknown[];
        [k: string]: unknown;
      };
      let items: unknown[] = Array.isArray(result) ? result : (result.items ?? []);
      if (input.strategy) {
        items = items.filter(
          (r) =>
            typeof r === "object" &&
            r !== null &&
            String((r as Record<string, unknown>).strategy_name ?? "")
              .toLowerCase()
              .includes(String(input.strategy).toLowerCase())
        );
      }
      return JSON.stringify(items);
    }

    case "list_indicators": {
      const plugins = (await apiFetch("/api/plugins?phase=indicator")) as Array<
        Record<string, unknown>
      >;
      return JSON.stringify(
        plugins.map((p) => ({
          name: p.name,
          fqn: p.fqn,
          description: p.description,
          signal_columns: p.signal_columns,
          feature_columns: (p.feature_columns as string[])?.slice(0, 10),
        }))
      );
    }

    case "get_indicator_schema": {
      const n = String(input.name);
      for (const fqn of [`fwbg-core:${n}`, `fwbg-premium:${n}`, n]) {
        try {
          return JSON.stringify(await apiFetch(`/api/plugins/${encodeURIComponent(fqn)}`));
        } catch {
          continue;
        }
      }
      throw new Error(`Indicator not found: ${n}`);
    }

    case "list_exit_strategies": {
      const plugins = (await apiFetch("/api/plugins?phase=exit_strategy")) as Array<
        Record<string, unknown>
      >;
      return JSON.stringify(
        plugins.map((p) => ({
          name: p.name,
          fqn: p.fqn,
          description: p.description,
          param_schema: p.param_schema,
          defaults: p.defaults,
        }))
      );
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ---------------------------------------------------------------------------
// SSE endpoint
// ---------------------------------------------------------------------------

export default defineEventHandler(async (event) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw createError({ statusCode: 500, statusMessage: "ANTHROPIC_API_KEY not set" });
  }

  const body = await readBody(event);
  const messages: Anthropic.MessageParam[] = body.messages ?? [];

  const config = useRuntimeConfig();
  const fwbgApiUrl = (config.fwbgApiUrl as string) || "http://localhost:8420";
  const client = new Anthropic({ apiKey });

  setResponseHeaders(event, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const enc = new TextEncoder();
  const sse = (data: unknown) => enc.encode(`data: ${JSON.stringify(data)}\n\n`);

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const history: Anthropic.MessageParam[] = [...messages];

        while (true) {
          const response = await client.messages.create({
            model: "claude-opus-4-6",
            max_tokens: 8096,
            system: `Du bist ein KI-Assistent, der direkt im FWBG-Dashboard läuft und Zugriff auf den FWBG Trading Strategy Optimizer hat.

Du kannst Strategien konfigurieren, Runs starten, Ergebnisse auswerten und Konfigurationen anpassen.

Wichtige Regeln für Strategiekonfigurationen:
- Immer signal_rules hinzufügen bei ML-Configs (ohne signal_rules → 0 OOS-Trades, da das Modell alle Bars sieht)
- CT (Confidence Threshold) bei neuen Strategien mit [0.35, 0.4, 0.45] starten
- Kombinations-Limit: exit × CT × regime × indicator_grid ≤ 50 (gegen Overfitting)
- datasource: "dukascopy" für Index-Strategien
- Wenn ein Run gestartet wird: dem User mitteilen dass er je nach Strategie 15-90 Minuten dauern kann

Wenn der User fragt ob ein Run noch läuft: get_run_status aufrufen.
Wenn der User Ergebnisse sehen will: get_run_results aufrufen und Key-KPIs erklären (PF, WR, fold_stability, CAGR).`,
            tools: FWBG_TOOLS,
            messages: history,
          });

          // Stream text
          for (const block of response.content) {
            if (block.type === "text" && block.text) {
              controller.enqueue(sse({ type: "text", content: block.text }));
            }
          }

          if (response.stop_reason === "end_turn") break;

          if (response.stop_reason === "tool_use") {
            const toolCalls = response.content.filter(
              (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
            );

            history.push({ role: "assistant", content: response.content });

            const toolResults: Anthropic.ToolResultBlockParam[] = [];
            for (const call of toolCalls) {
              controller.enqueue(sse({ type: "tool_start", name: call.name, input: call.input }));
              let result: string;
              try {
                result = await executeTool(
                  call.name,
                  call.input as Record<string, unknown>,
                  fwbgApiUrl
                );
                controller.enqueue(sse({ type: "tool_done", name: call.name }));
              } catch (err) {
                result = `Error: ${err instanceof Error ? err.message : String(err)}`;
                controller.enqueue(sse({ type: "tool_error", name: call.name, error: result }));
              }
              toolResults.push({ type: "tool_result", tool_use_id: call.id, content: result });
            }

            history.push({ role: "user", content: toolResults });
            continue;
          }

          break;
        }

        controller.enqueue(sse({ type: "done" }));
        controller.close();
      } catch (err) {
        controller.enqueue(
          sse({ type: "error", message: err instanceof Error ? err.message : String(err) })
        );
        controller.close();
      }
    },
  });

  return sendStream(event, stream);
});
