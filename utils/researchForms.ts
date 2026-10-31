/**
 * Request bodies built from the run start and new card forms. A builder returns
 * undefined while a required field is missing, so the form keeps its submit
 * button disabled; the server validates the body again (server/utils/research-schemas.ts).
 */
import type { ExitOptimizationRequest } from "~/types/exploration";
import type {
  NewResearchCardInput,
  RunStartBody,
  UnreadableResearchCard,
} from "~/types/research";

export interface RunStartForm {
  researchId: string | undefined;
  note: string;
  reason: string;
  holdout: boolean;
  assetClasses: string[];
  customAssets: string;
  description: string;
}

/** The research fields of a gated request; the analysis form asks only these. */
export type ResearchFields = Pick<RunStartForm, "researchId" | "note" | "reason">;

export interface NewCardForm {
  title: string;
  tags: string[];
  hypothesis: string;
  mechanism: string;
  /** YYYY-MM-DD from a date input, or empty. */
  cutoff: string;
}

export interface ResearchCardItem {
  label: string;
  value: string;
  disabled?: boolean;
}

// Python's str.splitlines() boundaries, as in the server schema: fwbg requires a
// single-line note, so a pasted line break becomes a space instead of a refusal.
const LINE_BREAKS = /[\n\r\v\f\x1c\x1d\x1e\x85\u2028\u2029]+/g;

/** research_id, note and reason as fwbg takes them, or undefined while one is missing. */
function researchBody(
  form: ResearchFields,
): Pick<RunStartBody, "research_id" | "note" | "reason"> | undefined {
  const note = form.note.replace(LINE_BREAKS, " ").trim();
  if (!form.researchId || !note) return undefined;
  const reason = form.reason.trim();
  return reason
    ? { research_id: form.researchId, note, reason }
    : { research_id: form.researchId, note };
}

/** Build a gated run request, or return undefined until its card and note are complete. */
export function buildRunStartBody(
  strategyName: string,
  form: RunStartForm,
): RunStartBody | undefined {
  const research = researchBody(form);
  if (!research) return undefined;

  const body: RunStartBody = { strategy_name: strategyName, ...research };
  if (form.holdout) body.holdout = true;
  if (form.assetClasses.length) body.asset_classes = [...form.assetClasses];
  const assets = form.customAssets
    .split(",")
    .map((a) => a.trim().toUpperCase())
    .filter(Boolean);
  if (assets.length) body.assets = assets;
  const description = form.description.trim();
  if (description) body.description = description;
  return body;
}

/**
 * The form for the next start: note, reason and holdout are asked again, so a
 * reason given for one deliberate repeat never carries over to the next run.
 */
export function formAfterStart(form: RunStartForm): RunStartForm {
  return { ...form, note: "", reason: "", holdout: false };
}

/** An exit analysis request, or undefined while the asset or a research field is missing. */
export function buildExitOptimizationBody(
  analysis: Omit<ExitOptimizationRequest, "research_id" | "note" | "reason">,
  form: ResearchFields,
): ExitOptimizationRequest | undefined {
  const research = researchBody(form);
  if (!research || !analysis.source || !analysis.symbol || !analysis.timeframe) return undefined;
  return { ...analysis, ...research };
}

export function buildNewCardInput(form: NewCardForm): NewResearchCardInput | undefined {
  const title = form.title.trim();
  const tags = [...new Set(form.tags.map((tag) => tag.trim()).filter(Boolean))];
  const hypothesis = form.hypothesis.trim();
  const mechanism = form.mechanism.trim();
  if (!title || !tags.length || !hypothesis || !mechanism) return undefined;

  const input: NewResearchCardInput = { title, tags, hypothesis, mechanism };
  if (form.cutoff) input.cutoff = form.cutoff;
  return input;
}

/** A select item `S-NNNN · title`; a card fwbg cannot read is listed disabled. */
export function researchCardItem(
  card: { id: string; title: string } | UnreadableResearchCard,
): ResearchCardItem {
  if ("error" in card) {
    return { label: `${card.id} · unreadable: ${card.error}`, value: card.id, disabled: true };
  }
  return { label: `${card.id} · ${card.title}`, value: card.id };
}

/**
 * The select items of a freshly loaded list and the selection to keep. Cards
 * created in this modal are added when the list was fetched before their creation;
 * a selection that is not listed or unreadable is cleared, so the start disables.
 */
export function cardSelection(
  loaded: ResearchCardItem[],
  created: ResearchCardItem[],
  researchId: string | undefined,
): { items: ResearchCardItem[]; researchId: string | undefined } {
  const listed = new Set(loaded.map((item) => item.value));
  const items = [...loaded, ...created.filter((item) => !listed.has(item.value))];
  const selected = items.find((item) => item.value === researchId);
  return { items, researchId: selected && !selected.disabled ? selected.value : undefined };
}
