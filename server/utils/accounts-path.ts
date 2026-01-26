/**
 * Shared utility to get accounts directory path
 * Extracted to avoid circular imports between settings.ts and ig-client.ts
 */

/**
 * Get the accounts directory path from runtime config or environment variable
 */
export function getAccountsPath(): string {
  try {
    const config = useRuntimeConfig();
    return config.accountsPath || "/app/accounts";
  } catch {
    // Fallback for WebSocket handlers where useRuntimeConfig might not work
    return process.env.ACCOUNTS_PATH || "/app/accounts";
  }
}
