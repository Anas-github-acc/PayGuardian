"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { NavTab, TablesSubTab } from "./workspace-store";

export type { NavTab, TablesSubTab };

export const VALID_NAV_TABS: NavTab[] = [
  "overview",
  "workspace",
  "assistant",
  "approvals",
  "traces",
  "tables",
  "security",
  "agents",
  "developer",
  "simulator",
];

export const VALID_TABLES_SUBTABS: TablesSubTab[] = ["mandates", "activity", "policies"];

/**
 * Parses search parameters to retrieve the active navigation tab.
 * Defaults strictly to "overview" when no valid tab is specified.
 */
export function getTabFromSearchParams(
  searchParams: URLSearchParams | { get: (key: string) => string | null }
): NavTab {
  const tab = searchParams.get("tab") as NavTab | null;
  return tab && VALID_NAV_TABS.includes(tab) ? tab : "overview";
}

/**
 * Parses search parameters to retrieve the active sub-tab for tables.
 * Defaults to "mandates".
 */
export function getSubTabFromSearchParams(
  searchParams: URLSearchParams | { get: (key: string) => string | null }
): TablesSubTab {
  const sub = searchParams.get("sub") as TablesSubTab | null;
  return sub && VALID_TABLES_SUBTABS.includes(sub) ? sub : "mandates";
}

/**
 * Custom React hook that drives dashboard navigation using URL query parameters as the single source of truth.
 * Supports browser back/forward navigation and eliminates race conditions from local storage or store state.
 */
export function useDashboardNavigation() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const activeTab = React.useMemo(() => getTabFromSearchParams(searchParams), [searchParams]);
  const activeSubTab = React.useMemo(() => getSubTabFromSearchParams(searchParams), [searchParams]);

  const navigateTab = React.useCallback(
    (tab: NavTab, sub?: TablesSubTab) => {
      const params = new URLSearchParams();
      if (tab !== "overview") {
        params.set("tab", tab);
      }
      if (tab === "tables" && sub) {
        params.set("sub", sub);
      }
      const qs = params.toString();
      const path = qs ? `/dashboard?${qs}` : "/dashboard";
      router.push(path);
    },
    [router]
  );

  return {
    activeTab,
    activeSubTab,
    navigateTab,
  };
}
