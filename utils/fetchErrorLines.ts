/**
 * Display lines for an error thrown by `$fetch` against the dashboard's server.
 *
 * `err.data` is the server's error envelope `{statusCode, statusMessage,
 * message, data}`. For an error proxied from fwbg its `data` is fwbg's JSON body
 * (see server/utils/fwbg-api.ts); for a request the dashboard refused itself
 * (`statusMessage: "Validation Error"`) its `message` is zod's issue list as JSON.
 */
import type { GateDenial } from "~/types/research";

// The error comes from the network: every field is read defensively.
type Fields = Record<string, unknown>;

function fields(value: unknown): Fields | undefined {
  return typeof value === "object" && value !== null ? (value as Fields) : undefined;
}

/** A string worth showing; blank text counts as absent. */
function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function isDenial(value: unknown): value is Pick<GateDenial, "code" | "message"> {
  const denial = fields(value);
  return typeof denial?.code === "string" && typeof denial.message === "string";
}

/** fwbg's `detail`: gate denials, a failed preflight's message and output, or a text. */
function fwbgDetailLines(detail: unknown): string[] | undefined {
  const detailText = text(detail);
  if (detailText) return [detailText];
  const body = fields(detail);
  if (!body) return undefined;
  if (Array.isArray(body.denials)) {
    const denials = body.denials.filter(isDenial).map((d) => `${d.code}: ${d.message}`);
    if (denials.length) return denials;
  }
  const message = text(body.message);
  if (!message) return undefined;
  const output = typeof body.output === "string" ? body.output.split("\n") : [];
  return [message, ...output.filter((line) => line.trim() !== "")];
}

function issueLine(value: unknown): string | undefined {
  const issue = fields(value);
  const message = text(issue?.message);
  if (!message) return undefined;
  const path = Array.isArray(issue?.path) ? issue.path.join(".") : "";
  return path ? `${path}: ${message}` : message;
}

function validationLines(envelope: Fields | undefined): string[] | undefined {
  if (envelope?.statusMessage !== "Validation Error") return undefined;
  const message = text(envelope.message);
  if (!message) return undefined;
  let issues: unknown;
  try {
    issues = JSON.parse(message);
  } catch {
    return [message];
  }
  const lines = Array.isArray(issues)
    ? issues.map(issueLine).filter((line): line is string => line !== undefined)
    : [];
  return lines.length ? lines : [message];
}

export function fetchErrorLines(err: unknown, fallback: string): string[] {
  const error = fields(err);
  const envelope = fields(error?.data);
  return (
    fwbgDetailLines(fields(envelope?.data)?.detail) ??
    validationLines(envelope) ?? [
      text(envelope?.detail) ??
        text(envelope?.message) ??
        text(error?.statusMessage) ??
        text(error?.message) ??
        fallback,
    ]
  );
}
