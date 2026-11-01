"use client";

import * as React from "react";
import {
  ChevronDown,
  Fingerprint,
  KeyRound,
  LogOut,
  PauseCircle,
  PanelLeft,
  PlayCircle,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { useWorkspaceStore, workspaceStore, type NavTab } from "../../app/lib/workspace-store";
import { useDashboardNavigation } from "../../app/lib/navigation";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "../ui/dropdown-menu";
import { EnvironmentSwitcher } from "./environment-switcher";

export interface AppHeaderProps {
  className?: string;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onSignOut?: () => void;
  activeTabOverride?: NavTab;
}

const TAB_TITLES: Record<string, string> = {
  overview: "Overview",
  workspace: "Workspace",
  assistant: "Assistant",
  approvals: "Approvals",
  traces: "Traces",
  tables: "Mandates",
  security: "Security",
  agents: "Agents",
  developer: "Developer",
  simulator: "Simulator",
};

export function AppHeader({
  className,
  sidebarOpen,
  onToggleSidebar,
  onSignOut,
  activeTabOverride,
}: AppHeaderProps) {
  const { activeTab, activeSubTab } = useDashboardNavigation();
  const { currentEnvironment, user } = useWorkspaceStore();
  const currentTab = activeTabOverride ?? activeTab;

  const isPaused = currentEnvironment?.status === "paused";

  const handleTogglePause = () => {
    if (!currentEnvironment) return;
    const nextStatus = isPaused ? "active" : "paused";
    workspaceStore.updateEnvironment(currentEnvironment.id, { status: nextStatus });
  };

  const handleOpenPasskeyModal = () => {
    workspaceStore.setPasskeyModalOpen(true);
  };

  const title =
    currentTab === "tables"
      ? activeSubTab === "activity"
        ? "Activity"
        : activeSubTab === "policies"
          ? "Policies"
          : "Mandates"
      : (TAB_TITLES[currentTab] ?? "Dashboard");

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-14 w-full shrink-0 items-center justify-between gap-3 border-b border-border bg-background px-4 select-none",
        className
      )}
    >
      {/* Left: sidebar toggle + environment switcher */}
      <div className="flex min-w-0 items-center gap-2.5">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          className="h-8 w-8 shrink-0"
        >
          <PanelLeft className="h-4 w-4" />
        </Button>
        <span title={title} className="min-w-0">
          <EnvironmentSwitcher />
        </span>
      </div>

      {/* Right: environment actions + profile */}
      <div className="flex items-center gap-2">
        {currentEnvironment?.type === "sandbox" && (
          <Badge variant="pending" className="hidden sm:inline-flex">
            Sandbox
          </Badge>
        )}

        {/* Quick Emergency Pause/Resume Action */}
        {currentEnvironment && (
          <Button
            size="sm"
            variant={isPaused ? "warning" : "outline"}
            onClick={handleTogglePause}
            className="h-8 gap-1.5 px-2.5 text-xs"
            title={isPaused ? "Resume environment operations" : "Emergency pause all agent operations"}
          >
            {isPaused ? (
              <>
                <PlayCircle className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Resume Ops</span>
              </>
            ) : (
              <>
                <PauseCircle className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Pause</span>
              </>
            )}
          </Button>
        )}

        {/* User Profile / Passkey Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="User profile and passkey options"
            className="flex h-8 items-center gap-2 rounded-full border border-border bg-card px-2 text-xs text-foreground transition-colors hover:bg-secondary"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-foreground">
              <Fingerprint className="h-3.5 w-3.5" />
            </span>
            <span className="hidden max-w-[100px] truncate text-xs font-medium text-muted-foreground sm:inline-block">
              {user?.name ?? "Operator"}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="space-y-1">
              <div className="text-xs font-semibold text-foreground">
                {user?.name ?? "Operator"}
              </div>
              <div className="truncate font-mono text-[11px] text-muted-foreground">
                {user?.email ?? "operator@payguardian.local"}
              </div>
              <div>
                <Badge variant="success" className="px-1.5 py-0 text-[9px]">
                  Passkey Level 3 Verified
                </Badge>
              </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            <DropdownMenuItem onClick={handleOpenPasskeyModal}>
              <KeyRound className="h-3.5 w-3.5" />
              <span>Passkey settings</span>
            </DropdownMenuItem>

            {onSignOut && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onSignOut?.()}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
