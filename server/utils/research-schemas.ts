/**
 * Request validation for the research register proxy and run starts.
 *
 * Mirrors fwbg's own checks so bad input is refused here with a 400 instead of
 * a slow round trip (a run start waits for fwbg's research preflight).
 * The run-start schema is deliberately narrower than fwbg's: fields the
 * dashboard does not send (preview, dates, cost multiplier) are rejected.
 */
import { z } from "zod";

// fwbg's NewCard uses the pydantic pattern `\S`; its research gate checks note and
// reason with Python's str.strip(). The two differ only on a few characters
// (strip() also removes \x1c-\x1f and \x85, JS `\s` also matches \ufeff), and a
// value made only of those is refused either here or by fwbg.
const nonBlank = z.string().regex(/\S/, "must not be blank");

// fwbg passes these values to its CLI as arguments; one with a NUL cannot be built.
const NO_NUL = /^[^\0]*$/;
const NUL_MESSAGE = "must not contain a NUL character";

// Python's str.splitlines() boundaries; fwbg requires note.splitlines() == [note].
const LINE_BOUNDARY = /[\n\r\v\f\x1c\x1d\x1e\x85\u2028\u2029]/;

// The research fields every gated request carries (run start, exit analysis).
const researchId = z.string().regex(/^S-\d{4}$/, "must be S- followed by four digits");
const note = nonBlank
  .regex(NO_NUL, NUL_MESSAGE)
  .refine((value) => !LINE_BOUNDARY.test(value), "must be a single line");
const reason = nonBlank.regex(NO_NUL, NUL_MESSAGE).optional();

export const runStartBodySchema = z.strictObject({
  strategy_name: nonBlank,
  assets: z.array(z.string()).optional(),
  asset_classes: z.array(z.string()).optional(),
  description: z.string().regex(NO_NUL, NUL_MESSAGE).optional(),
  research_id: researchId,
  note,
  reason,
  holdout: z.boolean().optional(),
});

/** An MFE/MAE exit analysis: recorded in the register like a run (fwbg gates it). */
export const exitOptimizationBodySchema = z.strictObject({
  source: nonBlank,
  symbol: nonBlank,
  timeframe: nonBlank.optional(),
  exit_strategy: nonBlank.optional(),
  exit_params: z.record(z.string(), z.unknown()).optional(),
  max_bars: z.number().int().positive().optional(),
  research_id: researchId,
  note,
  reason,
});

export const attachCardBodySchema = z.strictObject({
  research_id: researchId,
});

export const newResearchCardSchema = z.strictObject({
  title: nonBlank,
  tags: z.array(nonBlank).min(1),
  hypothesis: nonBlank,
  mechanism: nonBlank,
  cutoff: z.iso.date().optional(),
});

export const researchListQuerySchema = z.object({
  status: z.enum(["active", "parked", "rejected", "candidate"]).optional(),
  tag: nonBlank.optional(),
});

/**
 * The chat's `start_run` tool input: the run-start body without asset classes,
 * with descriptions that tell the model where each research field comes from.
 */
export const startRunToolInputSchema = runStartBodySchema
  .pick({
    strategy_name: true,
    assets: true,
    description: true,
    research_id: true,
    note: true,
    reason: true,
    holdout: true,
  })
  .extend({
    assets: runStartBodySchema.shape.assets.describe(
      "Optional asset filter override, e.g. ['NAS100', 'DAX']",
    ),
    description: runStartBodySchema.shape.description.describe("Optional description of this run"),
    research_id: runStartBodySchema.shape.research_id.describe(
      "Research card id (S- followed by four digits) the run is a trial of. Ask the user when unknown.",
    ),
    note: runStartBodySchema.shape.note.describe(
      "One line from the user: what changed in this run and why. Ask the user when unknown.",
    ),
    reason: runStartBodySchema.shape.reason.describe(
      "Only for a deliberate repeat the user asked for: why the same run is repeated. Never invent one.",
    ),
    holdout: runStartBodySchema.shape.holdout.describe(
      "true only when the user explicitly asks for the card's one-time holdout look.",
    ),
  });
