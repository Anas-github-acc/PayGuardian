"use client";

import * as React from "react";
import { cn } from "../../lib/utils";
import { AppHeader } from "./header";
import { Sidebar } from "./sidebar";
import { ReconnectBanner } from "./reconnect-banner";
import { PasskeyModal } from "../auth/passkey-modal";
import { CreateEnvironmentWizard } from "../wizard/create-environment-wizard";
import { useAuth } from "../../app/auth-provider";
import type { NavTab } from "../../app/lib/workspace-store";

export interface AppShellProps {
  children?: React.ReactNode;
  className?: string;
  activeTabOverride?: NavTab;
}

export function AppShell({ children, className, activeTabOverride }: AppShellProps) {
  const { signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = React.useState(true);

  // Mobile: start with the nav closed (it's a fixed overlay below lg)
  React.useEffect(() => {
    if (window.innerWidth < 1024) setSidebarOpen(false);
  }, []);

  return (
    <div className={cn("flex h-dvh w-full overflow-hidden bg-background text-foreground", className)}>
      {/* Navigation Sidebar */}
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeTabOverride={activeTabOverride}
      />

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
        />
      )}

      {/* Main Column */}
      <div className="flex min-w-0 flex-1 flex-col h-full overflow-hidden">
        <AppHeader
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((open) => !open)}
          onSignOut={() => void signOut()}
          activeTabOverride={activeTabOverride}
        />

        {/* Live Reconnect Banner */}
        <ReconnectBanner />

        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</main>
      </div>

      {/* Global Modals Controlled via Workspace Store */}
      <PasskeyModal />
      <CreateEnvironmentWizard />
    </div>
  );
}
