/**
 * Request bodies built from the run start and new card forms. A builder returns
 * undefined while a required field is missing, so the form keeps its submit
 * button disabled; the server validates the body again (server/utils/research-schemas.ts).
 */
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

export function buildRunStartBody(
  strategyName: string,
  form: RunStartForm,
): RunStartBody | undefined {
  const note = form.note.replace(LINE_BREAKS, " ").trim();
  if (!form.researchId || !note) return undefined;

  const body: RunStartBody = { strategy_name: strategyName, research_id: form.researchId, note };
  const reason = form.reason.trim();
  if (reason) body.reason = reason;
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

export function buildNewCardInput(form: NewCardForm): NewResearchCardInput | undefined {
  const title = form.title.trim();
  const tags = form.tags.map((tag) => tag.trim()).filter(Boolean);
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
