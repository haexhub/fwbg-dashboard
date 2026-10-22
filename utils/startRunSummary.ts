/**
 * The research fields of a chat `start_run` call as one line, so the user sees
 * which card and note the model counted the trial against. The input is the
 * model's tool call as streamed by the server: every field is read defensively.
 */
export function startRunSummary(input: unknown): string | undefined {
  if (typeof input !== "object" || input === null) return undefined;
  const { research_id, note, reason, holdout } = input as Record<string, unknown>;
  const parts = [
    typeof research_id === "string" ? research_id : undefined,
    typeof note === "string" ? `Notiz: ${note}` : undefined,
    typeof reason === "string" ? `Grund: ${reason}` : undefined,
    holdout === true ? "Holdout" : undefined,
  ].filter((part) => part !== undefined);
  return parts.length ? parts.join(" · ") : undefined;
}
