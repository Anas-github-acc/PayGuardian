"use client";

import * as React from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  LayoutDashboard,
  ListChecks,
  MessageSquare,
  ScrollText,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  Waypoints,
  Zap,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { useWorkspaceStore, type NavTab } from "../../app/lib/workspace-store";
import { useDashboardNavigation } from "../../app/lib/navigation";
import { useApprovals } from "../../lib/api/hooks/use-approvals";
import { StatusPill } from "./status-pill";

export interface SidebarProps {
  open: boolean;
  onClose: () => void;
  className?: string;
  activeTabOverride?: NavTab;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  group: "Product" | "Operations" | "Platform";
  tab: NavTab;
  matches?: (active: NavTab, tablesSubTab: string) => boolean;
  badge?: number;
  tag?: string;
}

export function Sidebar({ open, onClose, className, activeTabOverride }: SidebarProps) {
  const { activeTab, activeSubTab, navigateTab } = useDashboardNavigation();
  const { currentEnvironment } = useWorkspaceStore();
  const { approvals } = useApprovals(currentEnvironment?.id);
  const currentTab = activeTabOverride ?? activeTab;

  const livePendingCount = approvals.filter((a) => a.status === "pending").length;
  const pendingApprovalsCount = livePendingCount > 0 ? livePendingCount : (currentEnvironment?.pendingApprovalsCount ?? 0);
  const isSandbox = currentEnvironment?.type === "sandbox";

  const items: NavItem[] = [
    { id: "overview", label: "Overview", icon: LayoutDashboard, group: "Product", tab: "overview" },
    { id: "workspace", label: "Workspace", icon: Waypoints, group: "Product", tab: "workspace" },
    { id: "assistant", label: "Assistant", icon: MessageSquare, group: "Product", tab: "assistant" },
    {
      id: "approvals",
      label: "Approvals",
      icon: ShieldAlert,
      group: "Operations",
      tab: "approvals",
      badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : undefined,
    },
    {
      id: "mandates",
      label: "Mandates",
      icon: ScrollText,
      group: "Operations",
      tab: "tables",
      matches: (active, sub) => active === "tables" && sub === "mandates",
    },
    {
      id: "activity",
      label: "Activity",
      icon: ListChecks,
      group: "Operations",
      tab: "tables",
      matches: (active, sub) => active === "tables" && sub === "activity",
    },
    { id: "security", label: "Security", icon: ShieldCheck, group: "Operations", tab: "security" },
    { id: "agents", label: "Agents", icon: Bot, group: "Platform", tab: "agents" },
    { id: "developer", label: "Developer", icon: Terminal, group: "Platform", tab: "developer" },
    {
      id: "simulator",
      label: "Simulator",
      icon: Zap,
      group: "Platform",
      tab: "simulator",
      tag: isSandbox ? "SBX" : undefined,
    },
  ];

  const handleSelect = (item: NavItem) => {
    if (item.id === "mandates" || item.id === "activity") {
      navigateTab("tables", item.id);
    } else {
      navigateTab(item.tab);
    }
    // Only dismiss on mobile — the sidebar must stay open across tab changes on desktop
    if (window.matchMedia("(max-width: 1023px)").matches) onClose();
  };

  const isActive = (item: NavItem) =>
    item.matches ? item.matches(currentTab, activeSubTab) : currentTab === item.tab;

  const groups: NavItem["group"][] = ["Product", "Operations", "Platform"];

  return (
    <AnimatePresence initial={false}>
      <motion.aside
        key="sidebar"
        initial={false}
        animate={{
          width: open ? 220 : 0,
          x: open ? 0 : -240,
          opacity: open ? 1 : 0,
        }}
        transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
        className={cn(
          "sticky top-0 flex h-dvh shrink-0 flex-col overflow-hidden border-r border-border bg-background select-none",
          "max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-50 max-lg:shadow-2xl",
          !open && "pointer-events-none",
          className
        )}
        aria-label="Dashboard navigation"
        aria-hidden={!open}
      >
        {/* Brand */}
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
          <div className="flex h-6 w-6 items-center justify-center rounded-md border border-border bg-secondary text-foreground">
            <Image
              src="/payguardian.svg"
              alt="PayGuardian Logo"
              width={16}
              height={16}
              className="h-4 w-4 object-contain"
            />
          </div>
          <span className="text-sm font-semibold text-foreground">PayGuardian</span>
          <span className="rounded border border-border bg-secondary px-1 py-px font-mono text-[9px] font-medium text-muted-foreground uppercase">
            Gateway
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-2">
          {groups.map((group) => (
            <div key={group} className="mb-4 last:mb-0">
              <div className="px-2 pb-1.5 text-[11px] font-medium text-muted-foreground">{group}</div>
              <div className="space-y-0.5">
                {items
                  .filter((item) => item.group === group)
                  .map((item) => {
                    const active = isActive(item);
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelect(item)}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                          active
                            ? "bg-secondary text-link"
                            : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                        )}
                      >
                        <Icon className={cn("h-3.5 w-3.5 shrink-0", active ? "text-link" : "text-muted-foreground")} />
                        <span className="flex-1 text-left">{item.label}</span>
                        {item.badge !== undefined && (
                          <span className="flex h-4 min-w-4 items-center justify-center rounded-full border border-warning/30 bg-warning/10 px-1 font-mono text-[9px] font-bold text-warning">
                            {item.badge}
                          </span>
                        )}
                        {item.tag && (
                          <span className="rounded bg-secondary px-1 py-px font-mono text-[8px] font-medium text-muted-foreground uppercase">
                            {item.tag}
                          </span>
                        )}
                      </button>
                    );
                  })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer: gateway status */}
        <div className="shrink-0 border-t border-border p-3">
          <StatusPill />
        </div>
      </motion.aside>
    </AnimatePresence>
  );
}
