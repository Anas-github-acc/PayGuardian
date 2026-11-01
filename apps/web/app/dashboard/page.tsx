"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { AuthBoundary } from "../auth-provider";
import {
  useDashboardNavigation,
  type NavTab,
  type TablesSubTab,
} from "../lib/navigation";
import { useWorkspaceStore, workspaceStore } from "../lib/workspace-store";
import { AppShell } from "../../components/shell";

// Dynamic imports with SSR enabled for asynchronous and dynamic content
const Overview = dynamic(
  () => import("../../components/dashboard/overview").then((m) => m.Overview),
  { ssr: true }
);
const WorkspaceLayout = dynamic(
  () => import("../../components/workspace").then((m) => m.WorkspaceLayout),
  { ssr: true }
);
const AssistantView = dynamic(
  () => import("../../components/chat").then((m) => m.AssistantView),
  { ssr: true }
);
const ApprovalsInbox = dynamic(
  () => import("../../components/approvals").then((m) => m.ApprovalsInbox),
  { ssr: true }
);
const PaymentTraceView = dynamic(
  () => import("../../components/traces").then((m) => m.PaymentTraceView),
  { ssr: true }
);
const SecurityCenter = dynamic(
  () => import("../../components/security").then((m) => m.SecurityCenter),
  { ssr: true }
);
const AgentLibrary = dynamic(
  () => import("../../components/agents").then((m) => m.AgentLibrary),
  { ssr: true }
);
const DeveloperPortal = dynamic(
  () => import("../../components/developer").then((m) => m.DeveloperPortal),
  { ssr: true }
);
const AttackSimulator = dynamic(
  () => import("../../components/simulator").then((m) => m.AttackSimulator),
  { ssr: true }
);
const MandatesTable = dynamic(
  () => import("../../components/tables").then((m) => m.MandatesTable),
  { ssr: true }
);
const ActivityAuditTable = dynamic(
  () => import("../../components/tables").then((m) => m.ActivityAuditTable),
  { ssr: true }
);
const PoliciesTable = dynamic(
  () => import("../../components/tables").then((m) => m.PoliciesTable),
  { ssr: true }
);

export default function DashboardPage() {
  return (
    <AuthBoundary>
      <React.Suspense fallback={<DashboardLoadingShell />}>
        <UnifiedDashboard />
      </React.Suspense>
    </AuthBoundary>
  );
}

function UnifiedDashboard() {
  // Driven directly from URL query params as the single source of truth
  const { activeTab, activeSubTab, navigateTab } = useDashboardNavigation();
  const { currentEnvironment } = useWorkspaceStore();

  const handleViewTrace = React.useCallback(
    (traceId?: string) => {
      if (traceId) {
        workspaceStore.setSelectedTraceId(traceId);
      }
      navigateTab("traces");
    },
    [navigateTab]
  );

  const handleCloseTrace = React.useCallback(() => {
    navigateTab("overview");
  }, [navigateTab]);

  const renderActiveView = (tab: NavTab, subTab: TablesSubTab) => {
    switch (tab) {
      case "overview":
        return <Overview />;

      case "workspace":
        return <WorkspaceLayout onViewTrace={handleViewTrace} />;

      case "assistant":
        return <AssistantView onViewTrace={handleViewTrace} />;

      case "approvals":
        return (
          <ApprovalsInbox
            onViewTrace={handleViewTrace}
            onAmendLimit={() => navigateTab("tables", "policies")}
          />
        );

      case "traces":
        return <PaymentTraceView onClose={handleCloseTrace} />;

      case "tables":
        return (
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-background text-foreground">
            <div className="flex items-center justify-end border-b border-border bg-card px-6 py-3 sm:px-8">
              <span className="hidden font-mono text-[11px] text-muted-foreground md:inline">
                Environment: {currentEnvironment?.name ?? "Default"}
              </span>
            </div>

            <div className="flex-1 p-6 sm:p-8">
              {subTab === "mandates" && (
                <MandatesTable
                  onViewTrace={handleViewTrace}
                  onRevokeMandate={() => navigateTab("security")}
                />
              )}
              {subTab === "activity" && <ActivityAuditTable onViewTrace={handleViewTrace} />}
              {subTab === "policies" && <PoliciesTable />}
            </div>
          </div>
        );

      case "security":
        return <SecurityCenter onViewTrace={handleViewTrace} />;

      case "agents":
        return <AgentLibrary />;

      case "developer":
        return <DeveloperPortal />;

      case "simulator":
        return (
          <AttackSimulator onNavigateTab={(targetTab) => navigateTab(targetTab)} />
        );

      default:
        return <Overview />;
    }
  };

  return (
    <AppShell activeTabOverride={activeTab}>
      <React.Suspense fallback={<TabLoadingSkeleton tab={activeTab} />}>
        {renderActiveView(activeTab, activeSubTab)}
      </React.Suspense>
    </AppShell>
  );
}

/**
 * High-fidelity, dark zinc skeleton placeholder tailored per tab while dynamic/async content suspends.
 */
function TabLoadingSkeleton({ tab }: { tab: NavTab }) {
  return (
    <div className="flex-1 overflow-y-auto bg-black text-white p-6 animate-pulse select-none">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        {/* Breadcrumb Header skeleton */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-6 w-28 rounded-md bg-zinc-900 border border-zinc-800" />
            <span className="text-zinc-700">/</span>
            <div className="h-6 w-36 rounded-md bg-zinc-900/60 border border-zinc-800/60" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-8 w-28 rounded-lg bg-zinc-900 border border-zinc-800" />
            <div className="h-8 w-24 rounded-lg bg-zinc-900 border border-zinc-800" />
          </div>
        </div>

        {tab === "workspace" && (
          <div className="space-y-6">
            {/* KPI Strip */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 rounded-xl border border-zinc-800 bg-zinc-950 p-4" />
              ))}
            </div>
            {/* Topology Box */}
            <div className="h-[520px] rounded-xl border border-zinc-800 bg-zinc-950" />
            {/* Split cards */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="h-72 rounded-xl border border-zinc-800 bg-zinc-950" />
              <div className="h-72 rounded-xl border border-zinc-800 bg-zinc-950" />
            </div>
          </div>
        )}

        {tab === "assistant" && (
          <div className="flex flex-col h-[70vh] justify-between max-w-4xl mx-auto w-full">
            <div className="space-y-4 py-16 text-center">
              <div className="h-10 w-10 rounded-xl bg-zinc-900 border border-zinc-800 mx-auto" />
              <div className="h-6 w-48 rounded-md bg-zinc-900 mx-auto" />
              <div className="h-4 w-80 rounded-md bg-zinc-900/60 mx-auto" />
            </div>
            <div className="w-full h-32 rounded-xl border border-zinc-800 bg-zinc-950" />
          </div>
        )}

        {tab === "approvals" && (
          <div className="space-y-4">
            <div className="h-36 rounded-xl border border-zinc-800 bg-zinc-950 p-5" />
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-28 rounded-xl border border-zinc-800 bg-zinc-950" />
              ))}
            </div>
          </div>
        )}

        {tab !== "workspace" && tab !== "assistant" && tab !== "approvals" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-28 rounded-xl border border-zinc-800 bg-zinc-950" />
              ))}
            </div>
            <div className="h-80 rounded-xl border border-zinc-800 bg-zinc-950" />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Full page loading shell while the router / authentication initializes.
 */
function DashboardLoadingShell() {
  return (
    <div className="flex min-h-screen w-full bg-black text-white select-none">
      <div className="hidden lg:flex w-64 flex-col border-r border-zinc-800 bg-zinc-950 p-4 space-y-4">
        <div className="h-8 w-36 rounded-lg bg-zinc-900 border border-zinc-800 animate-pulse" />
        <div className="space-y-2 pt-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-9 w-full rounded-lg bg-zinc-900/60 animate-pulse" />
          ))}
        </div>
      </div>
      <div className="flex flex-1 flex-col">
        <div className="h-14 border-b border-zinc-800 bg-zinc-950 px-4 flex items-center justify-between">
          <div className="h-7 w-32 rounded-lg bg-zinc-900 animate-pulse" />
          <div className="h-7 w-20 rounded-lg bg-zinc-900 animate-pulse" />
        </div>
        <div className="flex-1 p-6 space-y-6 bg-black">
          <div className="h-8 w-48 rounded-md bg-zinc-900 animate-pulse" />
          <div className="h-[480px] rounded-xl border border-zinc-800 bg-zinc-950 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
