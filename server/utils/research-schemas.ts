/**
 * Request validation for the research register proxy and run starts.
 *
 * Mirrors fwbg's own checks so bad input is refused here with a 400 instead of
 * a slow round trip (a run start waits for fwbg's research preflight).
 */
import { z } from "zod";

// fwbg's non-blank check is the regex `\S` (pydantic Field(pattern=r"\S")).
const nonBlank = z.string().regex(/\S/, "must not be blank");

// Python's str.splitlines() boundaries; fwbg requires note.splitlines() == [note].
const LINE_BOUNDARY = /[\n\r\v\f\x1c\x1d\x1e\x85\u2028\u2029]/;

export const runStartBodySchema = z.strictObject({
  strategy_name: nonBlank,
  assets: z.array(z.string()).optional(),
  asset_classes: z.array(z.string()).optional(),
  description: z.string().optional(),
  research_id: z.string().regex(/^S-\d{4}$/, "must be S- followed by four digits"),
  note: nonBlank.refine((note) => !LINE_BOUNDARY.test(note), "must be a single line"),
  reason: nonBlank.optional(),
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
