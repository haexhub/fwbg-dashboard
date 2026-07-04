/**
 * POST /api/ai/chat
 *
 * SSE streaming endpoint. Accepts messages + model/provider selection,
 * runs the agentic loop with FWBG tools, and streams events to the client.
 *
 * Request body: { messages, model, provider, apiKey? }
 *
 * Stream events (JSON lines prefixed with "data: "):
 *   { type: "text",       content: string }
 *   { type: "tool_start", name: string, input: object }
 *   { type: "tool_done",  name: string }
 *   { type: "tool_error", name: string, error: string }
 *   { type: "done" }
 *   { type: "error",      message: string }
 */

import { streamText, tool, stepCountIs, type ModelMessage } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Provider factory
// ---------------------------------------------------------------------------

function getModel(provider: string, modelId: string, apiKey: string) {
  switch (provider) {
    case "openai":
      return createOpenAI({ apiKey })(modelId);
    case "google":
      return createGoogleGenerativeAI({ apiKey })(modelId);
    case "deepseek":
      return createOpenAI({ apiKey, baseURL: "https://api.deepseek.com/v1" })(modelId);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

/**
 * Claude goes through haex-claude-proxy (OAuth subscription, see
 * AiLlmConnectionCard on /ai) instead of a per-request API key. The proxy's
 * data-plane endpoints don't check the key at all — same dummy-key pattern
 * the fwbg-agents service already uses against it.
 */
function getAnthropicProxyModel(modelId: string) {
  const claudeProxyUrl = process.env.CLAUDE_PROXY_URL || "http://localhost:12102";
  return createAnthropic({
    // @ai-sdk/anthropic appends /messages itself, so baseURL must include
    // the /v1 root (mirrors the default https://api.anthropic.com/v1) —
    // haex-claude-proxy only routes POST /v1/messages, not /messages.
    baseURL: `${claudeProxyUrl}/v1`,
    apiKey: "proxy-not-used-but-sdk-requires-it",
  })(modelId);
}

// ---------------------------------------------------------------------------
// FWBG tool definitions (Vercel AI SDK / Zod format)
// ---------------------------------------------------------------------------

function makeFwbgTools(fwbgApiUrl: string) {
  const base = fwbgApiUrl.replace(/\/?$/, "");
  const agentsBase = (process.env.FWBG_AGENTS_API_URL || "http://localhost:8421").replace(/\/?$/, "");

  const apiFetch = async (path: string) => {
    const res = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    return res.json();
  };
  const apiPut = async (path: string, body: unknown) => {
    const res = await fetch(`${base}${path}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    return res.json();
  };
  const apiPost = async (path: string, body: unknown) => {
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    return res.json();
  };
  const agentsFetch = async (path: string) => {
    const res = await fetch(`${agentsBase}${path}`, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    return res.json();
  };
  const agentsPost = async (path: string) => {
    const res = await fetch(`${agentsBase}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    return res.json();
  };

  async function findAgentStrategy(strategyName: string): Promise<{ id: number; slug: string } | null> {
    const result = await agentsFetch("/strategies") as unknown;
    const list: Array<{ id: number; slug: string }> = Array.isArray(result)
      ? result
      : ((result as Record<string, unknown>).strategies as Array<{ id: number; slug: string }> ?? []);
    return list.find((s) => s.slug === strategyName) ?? null;
  }

  return {
    list_strategies: tool({
      description: "List all available strategy configs. Returns filename, name, description, tags.",
      inputSchema: z.object({}),
      execute: async () => JSON.stringify(await apiFetch("/api/strategies")),
    }),

    get_strategy: tool({
      description:
        "Load a strategy config by filename (without .json). Returns full config with resolved preset references.",
      inputSchema: z.object({
        name: z.string().describe("Strategy filename without .json extension"),
      }),
      execute: async ({ name }) => JSON.stringify(await apiFetch(`/api/strategies/${name}`)),
    }),

    save_strategy: tool({
      description:
        "Create or update a strategy config. Always include signal_rules for ML strategies – " +
        "without them the model sees all bars and produces 0 OOS trades.",
      inputSchema: z.object({
        name: z.string().describe("Strategy filename without .json"),
        config: z.record(z.string(), z.unknown()).describe("Full strategy configuration"),
      }),
      execute: async ({ name, config }) =>
        JSON.stringify(await apiPut(`/api/strategies/${name}`, config)),
    }),

    start_run: tool({
      description:
        "Start a strategy optimization run in the background. Returns run_id immediately. " +
        "Use get_run_status to track progress.",
      inputSchema: z.object({
        strategy_name: z.string(),
        assets: z
          .array(z.string())
          .optional()
          .describe("Optional asset filter override, e.g. ['NAS100', 'DAX']"),
        description: z.string().optional().describe("Optional note for this run"),
      }),
      execute: async ({ strategy_name, assets, description }) => {
        const body: Record<string, unknown> = { strategy_name };
        if (assets) body.assets = assets;
        if (description) body.description = description;
        return JSON.stringify(await apiPost("/api/runs/start", body));
      },
    }),

    get_run_status: tool({
      description:
        "Get current status and progress of a run. Returns status (running/completed/failed), " +
        "progress_fraction, current_stage.",
      inputSchema: z.object({ run_id: z.string() }),
      execute: async ({ run_id }) =>
        JSON.stringify(await apiFetch(`/api/runs/${run_id}/progress`)),
    }),

    get_run_results: tool({
      description:
        "Get full results for a completed run: summary KPIs, per-asset PF/WR/CAGR/max_drawdown, " +
        "fold stability, walk-forward breakdown. Only call for completed runs.",
      inputSchema: z.object({ run_id: z.string() }),
      execute: async ({ run_id }) => {
        const run = await apiFetch(`/api/runs/${run_id}`);
        try {
          const assets = (await apiFetch(`/api/runs/${run_id}/grid_details`)) as string[];
          const details: Record<string, unknown> = {};
          for (const asset of assets) {
            details[asset] = await apiFetch(`/api/runs/${run_id}/grid_details/${asset}`);
          }
          (run as Record<string, unknown>).grid_details = details;
        } catch {
          // grid_details may not exist
        }
        return JSON.stringify(run);
      },
    }),

    get_run_logs: tool({
      description: "Get structured logs for a run. Use level='error' or level='info' to filter noise.",
      inputSchema: z.object({
        run_id: z.string(),
        level: z
          .enum(["info", "debug", "warning", "error"])
          .optional()
          .describe("Optional level filter"),
        limit: z.number().int().optional().describe("Max entries (default 100)"),
      }),
      execute: async ({ run_id, level, limit }) => {
        const params = new URLSearchParams();
        if (level) params.set("level", level);
        params.set("limit", String(limit ?? 100));
        return JSON.stringify(await apiFetch(`/api/runs/${run_id}/logs?${params}`));
      },
    }),

    list_recent_runs: tool({
      description: "List recent runs with their status and outcome summary.",
      inputSchema: z.object({
        limit: z.number().int().optional().describe("Number of runs (default 10)"),
        strategy: z.string().optional().describe("Optional strategy name filter (substring)"),
      }),
      execute: async ({ limit, strategy }) => {
        const params = new URLSearchParams();
        params.set("limit", String(limit ?? 10));
        const result = (await apiFetch(`/api/runs?${params}`)) as {
          items?: unknown[];
          [k: string]: unknown;
        };
        let items: unknown[] = Array.isArray(result) ? result : (result.items ?? []);
        if (strategy) {
          items = items.filter(
            (r) =>
              typeof r === "object" &&
              r !== null &&
              String((r as Record<string, unknown>).strategy_name ?? "")
                .toLowerCase()
                .includes(String(strategy).toLowerCase())
          );
        }
        return JSON.stringify(items);
      },
    }),

    list_indicators: tool({
      description:
        "List all available indicator plugins with signal_columns (use in signal_rules) and feature_columns.",
      inputSchema: z.object({}),
      execute: async () => {
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
      },
    }),

    get_indicator_schema: tool({
      description:
        "Get full param schema for an indicator: types, defaults, signal/feature columns. " +
        "Use the signal_columns in signal_rules to pre-filter bars for the ML model.",
      inputSchema: z.object({
        name: z
          .string()
          .describe("Short name like 'opening_range' or fqn like 'fwbg-core:opening_range'"),
      }),
      execute: async ({ name }) => {
        for (const fqn of [`fwbg-core:${name}`, `fwbg-premium:${name}`, name]) {
          try {
            return JSON.stringify(await apiFetch(`/api/plugins/${encodeURIComponent(fqn)}`));
          } catch {
            continue;
          }
        }
        throw new Error(`Indicator not found: ${name}`);
      },
    }),

    list_exit_strategies: tool({
      description:
        "List all available exit strategy plugins with param schema. " +
        "Key params: tp_mult (TP as ATR multiple), sl_mult (SL as ATR multiple), timeout_bars.",
      inputSchema: z.object({}),
      execute: async () => {
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
      },
    }),

    trigger_analyst: tool({
      description:
        "Trigger the Analyst agent for a strategy by its slug/name. " +
        "The analyst reads the latest backtest results, updates the hypothesis, and derives improvement suggestions. " +
        "Returns agent_run_id — use get_agent_run_status to track progress.",
      inputSchema: z.object({
        strategy_name: z.string().describe("Strategy slug/name as used in fwbg (e.g. 'my_strategy')"),
      }),
      execute: async ({ strategy_name }) => {
        const strategy = await findAgentStrategy(strategy_name);
        if (!strategy) {
          return JSON.stringify({
            error: `Strategy '${strategy_name}' not found in the agent system. Make sure it exists as an agent strategy first.`,
          });
        }
        const result = await agentsPost(`/strategies/${strategy.id}/analyze`);
        return JSON.stringify(result);
      },
    }),

    trigger_runner: tool({
      description:
        "Trigger the Runner agent (backtest) for a strategy by its slug/name. " +
        "Returns agent_run_id — use get_agent_run_status to track progress.",
      inputSchema: z.object({
        strategy_name: z.string().describe("Strategy slug/name as used in fwbg (e.g. 'my_strategy')"),
      }),
      execute: async ({ strategy_name }) => {
        const strategy = await findAgentStrategy(strategy_name);
        if (!strategy) {
          return JSON.stringify({
            error: `Strategy '${strategy_name}' not found in the agent system.`,
          });
        }
        const result = await agentsPost(`/strategies/${strategy.id}/run`);
        return JSON.stringify(result);
      },
    }),

    get_agent_run_status: tool({
      description:
        "Get the status of an fwbg-agents run (analyst, runner, researcher, etc.) by its agent_run_id. " +
        "Returns status (pending/running/done/failed) and error if any.",
      inputSchema: z.object({
        agent_run_id: z.number().int().describe("The agent_run_id returned by trigger_analyst or trigger_runner"),
      }),
      execute: async ({ agent_run_id }) => {
        const result = await agentsFetch(`/agents/runs/${agent_run_id}`);
        return JSON.stringify(result);
      },
    }),
  };
}

// ---------------------------------------------------------------------------
// SSE endpoint
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `Du bist ein KI-Assistent, der direkt im FWBG-Dashboard läuft und Zugriff auf den FWBG Trading Strategy Optimizer hat.

Du kannst Strategien konfigurieren, Runs starten, Ergebnisse auswerten und Konfigurationen anpassen.

Wichtige Regeln für Strategiekonfigurationen:
- Immer signal_rules hinzufügen bei ML-Configs (ohne signal_rules → 0 OOS-Trades, da das Modell alle Bars sieht)
- CT (Confidence Threshold) bei neuen Strategien mit [0.35, 0.4, 0.45] starten
- Kombinations-Limit: exit × CT × regime × indicator_grid ≤ 50 (gegen Overfitting)
- datasource: "dukascopy" für Index-Strategien
- Wenn ein Run gestartet wird: dem User mitteilen dass er je nach Strategie 15-90 Minuten dauern kann

Wenn der User fragt ob ein Run noch läuft: get_run_status aufrufen.
Wenn der User Ergebnisse sehen will: get_run_results aufrufen und Key-KPIs erklären (PF, WR, fold_stability, CAGR).

Du hast auch Zugriff auf das fwbg-agents System (Analyst, Runner, Researcher):
- trigger_analyst: Startet den Analyst-Agenten für eine Strategie (liest Backtest-Ergebnisse und erstellt Hypothesen/Verbesserungsvorschläge)
- trigger_runner: Startet den Runner-Agenten (führt den nächsten Backtest in der Queue aus)
- get_agent_run_status: Prüft den Status eines gestarteten Agent-Runs

Wenn der User konkrete Verbesserungen umsetzen will: erst save_strategy, dann trigger_runner und trigger_analyst in Reihe.`;

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const messages: ModelMessage[] = body.messages ?? [];
  const provider: string = body.provider ?? "anthropic";
  const modelId: string = body.model ?? "claude-opus-4-6";

  // Claude has no per-request key at all (proxy-backed); other providers
  // still take one from env (server-side) or the request body (UI localStorage).
  let apiKey: string | undefined;
  if (provider !== "anthropic") {
    const envKey =
      provider === "openai"
        ? process.env.OPENAI_API_KEY
        : provider === "google"
          ? process.env.GOOGLE_API_KEY
          : provider === "deepseek"
            ? process.env.DEEPSEEK_API_KEY
            : undefined;

    apiKey = envKey || (body.apiKey as string | undefined);
    if (!apiKey) {
      throw createError({ statusCode: 401, statusMessage: "API_KEY_MISSING" });
    }
  }

  const config = useRuntimeConfig();
  const fwbgApiUrl = (config.fwbgApiUrl as string) || "http://localhost:8420";

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
        const model =
          provider === "anthropic" ? getAnthropicProxyModel(modelId) : getModel(provider, modelId, apiKey!);
        const tools = makeFwbgTools(fwbgApiUrl);

        const result = streamText({
          model,
          system: SYSTEM_PROMPT,
          tools,
          messages,
          stopWhen: stepCountIs(15),
        });

        for await (const chunk of result.fullStream) {
          if (chunk.type === "text-delta") {
            controller.enqueue(sse({ type: "text", content: chunk.text }));
          } else if (chunk.type === "tool-call") {
            controller.enqueue(
              sse({ type: "tool_start", name: chunk.toolName, input: chunk.input })
            );
          } else if (chunk.type === "tool-result") {
            controller.enqueue(sse({ type: "tool_done", name: chunk.toolName }));
          } else if (chunk.type === "tool-error") {
            controller.enqueue(
              sse({ type: "tool_error", name: chunk.toolName, error: String(chunk.error) })
            );
          } else if (chunk.type === "error") {
            controller.enqueue(
              sse({ type: "error", message: String((chunk as { type: "error"; error: unknown }).error) })
            );
          }
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
