"use client";

import * as React from "react";
import { Check, ChevronDown, Plus, ShieldCheck, TestTube2 } from "lucide-react";
import { cn } from "../../lib/utils";
import { formatMinorUnits } from "../../app/lib/currency";
import { useWorkspaceStore, workspaceStore } from "../../app/lib/workspace-store";
import { Badge } from "../ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "../ui/dropdown-menu";

export interface EnvironmentSwitcherProps {
  className?: string;
}

export function EnvironmentSwitcher({ className }: EnvironmentSwitcherProps) {
  const { currentEnvironment, environmentsList } = useWorkspaceStore();

  const handleSelect = (envId: string) => {
    if (envId === currentEnvironment?.id) return;
    // Atomic switch + flush of all workspace state
    workspaceStore.switchEnvironment(envId);
  };

  const handleOpenWizard = () => {
    workspaceStore.setCreateWizardOpen(true);
  };

  const formattedBudget = currentEnvironment
    ? formatMinorUnits(currentEnvironment.budgetLimitMinor, currentEnvironment.currency)
    : "$0.00";

  const isSandbox = currentEnvironment?.type === "sandbox";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "group flex h-8 items-center gap-2 rounded-md border border-border bg-card px-2.5 text-xs transition-all duration-150 hover:bg-secondary select-none",
          className
        )}
      >
        {/* Environment Icon */}
        <span className="flex h-5 w-5 items-center justify-center rounded bg-secondary text-muted-foreground group-hover:text-foreground">
          {isSandbox ? (
            <TestTube2 className="h-3 w-3" />
          ) : (
            <ShieldCheck className="h-3 w-3" />
          )}
        </span>

        {/* Environment Name & Type */}
        <span className="flex items-center gap-1.5 text-left">
          <span className="max-w-[130px] sm:max-w-[170px] truncate font-medium text-foreground">
            {currentEnvironment?.name ?? "Select Environment"}
          </span>

          {currentEnvironment && (
            <Badge
              variant={isSandbox ? "pending" : "authorized"}
              className="px-1.5 py-0 text-[9px] uppercase tracking-wider font-semibold"
            >
              {isSandbox ? "Sandbox" : "Prod"}
            </Badge>
          )}
        </span>

        {/* Formatted Budget Indicator */}
        {currentEnvironment && (
          <span className="hidden font-mono text-[11px] text-muted-foreground md:inline-block tabular-nums">
            {formattedBudget}
          </span>
        )}

        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform duration-150 group-hover:text-foreground group-data-[state=open]:rotate-180 group-data-[state=open]:text-foreground" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-wider">
          Active Environments ({environmentsList.length})
        </DropdownMenuLabel>

        {environmentsList.map((env) => {
          const isSelected = env.id === currentEnvironment?.id;
          const envIsSandbox = env.type === "sandbox";
          const envBudget = formatMinorUnits(env.budgetLimitMinor, env.currency);

          return (
            <DropdownMenuItem
              key={env.id}
              onClick={() => handleSelect(env.id)}
              className="gap-2 py-2"
            >
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded",
                  envIsSandbox ? "bg-secondary text-muted-foreground" : "bg-secondary text-foreground"
                )}
              >
                {envIsSandbox ? (
                  <TestTube2 className="h-3 w-3" />
                ) : (
                  <ShieldCheck className="h-3 w-3" />
                )}
              </span>
              <span className="flex flex-1 flex-col truncate text-left">
                <span className="font-medium text-foreground truncate">{env.name}</span>
                <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                  {envBudget} Limit · {env.currency}
                </span>
              </span>
              {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-foreground" />}
            </DropdownMenuItem>
          );
        })}

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={handleOpenWizard} className="font-medium text-foreground">
          <Plus className="h-3.5 w-3.5" />
          <span>Create environment…</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
