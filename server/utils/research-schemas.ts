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

export const runStartBodySchema = z.strictObject({
  strategy_name: nonBlank,
  assets: z.array(z.string()).optional(),
  asset_classes: z.array(z.string()).optional(),
  description: z.string().regex(NO_NUL, NUL_MESSAGE).optional(),
  research_id: z.string().regex(/^S-\d{4}$/, "must be S- followed by four digits"),
  note: nonBlank
    .regex(NO_NUL, NUL_MESSAGE)
    .refine((note) => !LINE_BOUNDARY.test(note), "must be a single line"),
  reason: nonBlank.regex(NO_NUL, NUL_MESSAGE).optional(),
  holdout: z.boolean().optional(),
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
