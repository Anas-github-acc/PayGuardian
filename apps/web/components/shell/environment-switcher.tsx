"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Plus, ShieldCheck, TestTube2, Trash2, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";
import { formatMinorUnits } from "../../app/lib/currency";
import { workspaceStore, type Environment } from "../../app/lib/workspace-store";
import { useEnvironments } from "../../lib/api/hooks";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
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
  const router = useRouter();
  const { environments, currentEnvironment, isLoading, deleteEnvironment } = useEnvironments();
  const environmentsList = environments;

  const [envToDelete, setEnvToDelete] = React.useState<Environment | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [deleteConfirmationInput, setDeleteConfirmationInput] = React.useState("");
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  const envToDeleteName = envToDelete?.name ?? "";
  const isDeleteMatch = deleteConfirmationInput.trim() === envToDeleteName.trim();

  const handleSelect = (envId: string) => {
    if (envId === currentEnvironment?.id) return;
    // Atomic switch + flush of all workspace state
    workspaceStore.switchEnvironment(envId);
  };

  const handleOpenWizard = () => {
    if (environmentsList.length === 0) {
      router.push("/onboarding");
    } else {
      workspaceStore.setCreateWizardOpen(true);
    }
  };

  const handleConfirmDelete = async () => {
    if (!envToDelete || isDeleting || !isDeleteMatch) return;
    setIsDeleting(true);
    setDeleteError(null);
    const wasLastEnv = environmentsList.length <= 1;
    try {
      const success = await deleteEnvironment(envToDelete.id);
      if (success) {
        setEnvToDelete(null);
        setDeleteConfirmationInput("");
        if (wasLastEnv) {
          router.push("/onboarding");
        }
      } else {
        setDeleteError("Failed to delete environment. Please check ledger state and try again.");
      }
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete environment");
    } finally {
      setIsDeleting(false);
    }
  };

  const formattedBudget = currentEnvironment
    ? formatMinorUnits(currentEnvironment.budgetLimitMinor, currentEnvironment.currency)
    : "$0.00";

  const isSandbox = currentEnvironment?.type === "sandbox";

  return (
    <>
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "group flex h-8 items-center gap-2 rounded-md border border-border bg-card px-2.5 text-xs transition-all duration-150 hover:bg-secondary select-none",
          className
        )}
      >
        {/* Environment Icon */}
        <span suppressHydrationWarning className="flex h-5 w-5 items-center justify-center rounded bg-secondary text-muted-foreground group-hover:text-foreground">
          {isLoading && !currentEnvironment ? (
            <div className="h-2.5 w-2.5 rounded-full border border-primary border-t-transparent animate-spin" />
          ) : isSandbox ? (
            <TestTube2 className="h-3 w-3" />
          ) : currentEnvironment ? (
            <ShieldCheck className="h-3 w-3" />
          ) : (
            <Plus className="h-3 w-3" />
          )}
        </span>

        {/* Environment Name & Type */}
        <span className="flex items-center gap-1.5 text-left">
          <span suppressHydrationWarning className="max-w-[130px] sm:max-w-[170px] truncate font-medium text-foreground">
            {isLoading && !currentEnvironment
              ? "Loading..."
              : currentEnvironment?.name ?? "No Environments"}
          </span>

          {currentEnvironment ? (
            <Badge
              variant={isSandbox ? "pending" : "authorized"}
              className="px-1.5 py-0 text-[9px] uppercase tracking-wider font-semibold"
            >
              {isSandbox ? "Sandbox" : "Prod"}
            </Badge>
          ) : !isLoading ? (
            <Badge
              variant="secondary"
              className="px-1.5 py-0 text-[9px] uppercase tracking-wider text-muted-foreground border-border"
            >
              Setup Needed
            </Badge>
          ) : null}
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

        {environmentsList.length === 0 ? (
          <div className="p-3 text-center text-xs text-muted-foreground">
            <p className="font-medium text-foreground mb-1">No environments found</p>
            <p className="text-[11px] leading-relaxed mb-2.5">
              Create an isolated environment to begin bounded agent delegation.
            </p>
            <button
              type="button"
              onClick={() => router.push("/onboarding")}
              className="w-full text-center py-1.5 px-2 rounded-md bg-black text-white dark:bg-white dark:text-black font-medium text-[11px] hover:opacity-90 transition-opacity"
            >
              Start Onboarding Slide Flow
            </button>
          </div>
        ) : (
          environmentsList.map((env) => {
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
                <button
                  type="button"
                  title={`Delete ${env.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setEnvToDelete(env);
                  }}
                  className="ml-1 p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/15 transition-all opacity-40 hover:opacity-100 shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuItem>
            );
          })
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={handleOpenWizard} className="font-medium text-foreground">
          <Plus className="h-3.5 w-3.5" />
          <span>Create environment…</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>

    <Dialog
      open={!!envToDelete}
      onOpenChange={(open) => {
        if (!open && !isDeleting) {
          setEnvToDelete(null);
          setDeleteConfirmationInput("");
          setDeleteError(null);
        }
      }}
    >
      <DialogContent className="sm:max-w-md bg-card border border-border p-6 shadow-2xl">
        <DialogHeader className="space-y-2 text-left">
          <DialogTitle className="text-base font-semibold text-foreground">
            Delete Environment
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
            This will permanently delete the environment and related resources like
            Credentials, Child Mandates, and Ledger Allocations.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground block">
              To confirm, type <span className="font-semibold text-foreground">“{envToDeleteName}”</span>
            </label>
            <Input
              value={deleteConfirmationInput}
              onChange={(e) => {
                setDeleteConfirmationInput(e.target.value);
                setDeleteError(null);
              }}
              placeholder={envToDeleteName}
              disabled={isDeleting}
              className={cn(
                "h-9 text-xs font-mono bg-background border-border",
                deleteConfirmationInput && !isDeleteMatch && "border-destructive/60 focus-visible:ring-destructive"
              )}
              autoFocus
            />
            {deleteConfirmationInput && !isDeleteMatch && (
              <p className="text-[11px] text-destructive flex items-center gap-1 mt-1">
                <AlertCircle className="size-3 shrink-0" />
                <span>Typing “{envToDeleteName}” is required</span>
              </p>
            )}
          </div>

          {/* Warning Box */}
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>Deleting {envToDeleteName} cannot be undone.</span>
          </div>

          {deleteError && (
            <div className="rounded-md border border-destructive bg-destructive/15 p-2.5 text-xs text-destructive">
              {deleteError}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2 mt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isDeleting}
            onClick={() => {
              setEnvToDelete(null);
              setDeleteConfirmationInput("");
              setDeleteError(null);
            }}
            className="border-border bg-background hover:bg-muted text-foreground text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={!isDeleteMatch || isDeleting}
            onClick={handleConfirmDelete}
            className="text-xs font-medium disabled:opacity-40 flex items-center gap-1.5"
          >
            {isDeleting ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <span>Delete Environment</span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
