import type { SetupStatus } from "~/types/setup";

const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * Non-blocking onboarding redirect.
 *
 * On a fresh instance (no data source / no Claude connection) the user is
 * nudged to the guided /setup wizard — but only ONCE, and never in a way that
 * traps them:
 *  - leaving the wizard (from `/setup`) is always respected, no bounce-back;
 *  - the first probe flips `fwbg_setup_dismissed`, so later navigations don't
 *    redirect again (the dashboard checklist takes over discoverability);
 *  - the wizard's "Später" button also sets that cookie explicitly.
 */
export default defineNuxtRouteMiddleware(async (to, from) => {
  // Never trap the user on the wizard itself, and never bounce them back when
  // they deliberately navigate away from it (e.g. "Später" or a nav link).
  if (to.path === "/setup" || from.path === "/setup") return;

  const dismissed = useCookie<boolean>("fwbg_setup_dismissed", {
    maxAge: ONE_YEAR,
    sameSite: "lax",
  });
  if (dismissed.value) return;

  try {
    const status = await $fetch<SetupStatus>("/api/setup/status");
    // One-shot nudge: whether complete or not, don't auto-redirect again.
    dismissed.value = true;
    if (!status.isComplete) return navigateTo("/setup");
  } catch {
    // If the aggregator itself errors, don't get in the user's way.
  }
});
