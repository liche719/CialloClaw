import { loadStoredValue, saveStoredValue } from "@/platform/storage";

const DASHBOARD_FIRST_USE_GUIDE_KEY = "cialloclaw.dashboard.first-use-guide";
const DASHBOARD_FIRST_USE_GUIDE_VERSION = 1;

type StoredDashboardFirstUseGuideState = {
  dismissed_at?: string | null;
  version?: number;
};

export type DashboardFirstUseGuideState = {
  dismissedAt: string | null;
  shouldShow: boolean;
  version: number;
};

/**
 * Loads the local-only first-use guide state for the dashboard home window.
 *
 * This flag stays outside formal task or RPC data because it only controls
 * whether the current desktop user still needs the onboarding explanation.
 *
 * @returns The normalized guide state for the current dashboard guide version.
 */
export function loadDashboardFirstUseGuideState(): DashboardFirstUseGuideState {
  const storedState = loadStoredValue<StoredDashboardFirstUseGuideState>(DASHBOARD_FIRST_USE_GUIDE_KEY);
  const storedVersion = typeof storedState?.version === "number" ? storedState.version : 0;
  const dismissedAt = typeof storedState?.dismissed_at === "string" ? storedState.dismissed_at : null;
  const shouldShow = storedVersion !== DASHBOARD_FIRST_USE_GUIDE_VERSION || dismissedAt === null;

  return {
    dismissedAt: shouldShow ? null : dismissedAt,
    shouldShow,
    version: DASHBOARD_FIRST_USE_GUIDE_VERSION,
  };
}

/**
 * Persists that the current dashboard onboarding guide has been acknowledged.
 *
 * @param dismissedAt ISO timestamp describing when the user completed the guide.
 */
export function markDashboardFirstUseGuideSeen(dismissedAt = new Date().toISOString()) {
  saveStoredValue(DASHBOARD_FIRST_USE_GUIDE_KEY, {
    dismissed_at: dismissedAt,
    version: DASHBOARD_FIRST_USE_GUIDE_VERSION,
  });
}
