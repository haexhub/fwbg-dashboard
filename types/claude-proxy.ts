// ──────────────────────────────────────────────
// haex-claude-proxy OAuth setup domain types
//
// Mirrors haex-claude-proxy's setup-login.js state machine 1:1 — see that
// repo's src/setup-login.js for the authoritative state transitions.
// ──────────────────────────────────────────────

export type ClaudeProxySetupState =
  | "idle"
  | "awaiting-url"
  | "awaiting-code"
  | "finishing"
  | "done"
  | "error";

export interface ClaudeProxySetupStatus {
  state: ClaudeProxySetupState;
  oauthUrl: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  credentialsExist: boolean;
}
