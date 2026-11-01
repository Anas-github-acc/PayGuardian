"use client";

import * as React from "react";
import { Search, Bot, CheckCircle2 } from "lucide-react";
import { useWorkspaceStore } from "../../app/lib/workspace-store";
import { CATALOG_AGENTS, type SpecialistAgent, type AgentCategory } from "./types";
import { AgentCard } from "./AgentCard";
import { AgentDetailDrawer } from "./AgentDetailDrawer";
import { AttachAgentDialog } from "./AttachAgentDialog";
import { Input } from "../ui/input";
import { Button } from "../ui/button";

export interface AgentLibraryProps {
  className?: string;
}

export function AgentLibrary({ className = "" }: AgentLibraryProps) {
  const store = useWorkspaceStore();
  const currentEnv = store.currentEnvironment;

  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedCategory, setSelectedCategory] = React.useState<AgentCategory>("all");
  const [showAttachedOnly, setShowAttachedOnly] = React.useState(false);

  // Modal / Drawer states
  const [inspectingAgent, setInspectingAgent] = React.useState<SpecialistAgent | null>(null);
  const [attachingAgent, setAttachingAgent] = React.useState<SpecialistAgent | null>(null);
  const [notification, setNotification] = React.useState<{ message: string; type: "success" | "info" } | null>(null);

  // Attached agent ids + node status based on current workspace graph nodes
  const nodeStatusById = React.useMemo(() => {
    return new Map(store.graphNodes.map((n) => [n.id, n.status]));
  }, [store.graphNodes]);

  // Filtered agent list
  const filteredAgents = React.useMemo(() => {
    return CATALOG_AGENTS.filter((agent) => {
      // Category filter
      if (selectedCategory !== "all" && agent.category !== selectedCategory) {
        return false;
      }
      // Attached filter
      if (showAttachedOnly && !nodeStatusById.has(agent.id)) {
        return false;
      }
      // Search query filter
      if (searchQuery.trim().length > 0) {
        const query = searchQuery.toLowerCase();
        const matchesName = agent.name.toLowerCase().includes(query);
        const matchesSpecialty = agent.specialty.toLowerCase().includes(query);
        const matchesDesc = agent.description.toLowerCase().includes(query);
        const matchesTagline = agent.tagline.toLowerCase().includes(query);
        if (!matchesName && !matchesSpecialty && !matchesDesc && !matchesTagline) {
          return false;
        }
      }
      return true;
    });
  }, [selectedCategory, showAttachedOnly, searchQuery, nodeStatusById]);

  const attachedAgents = filteredAgents.filter((a) => nodeStatusById.has(a.id));
  const availableAgents = filteredAgents.filter((a) => !nodeStatusById.has(a.id));

  const categories: { id: AgentCategory; label: string }[] = [
    { id: "all", label: "All Agents" },
    { id: "logistics", label: "Logistics & Travel" },
    { id: "infrastructure", label: "Cloud Infra" },
    { id: "procurement", label: "Procurement" },
    { id: "finance", label: "Finance & Payroll" },
    { id: "gateway", label: "API Gateway" },
    { id: "compliance", label: "Compliance" },
  ];

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedCategory("all");
    setShowAttachedOnly(false);
  };

  const handleInspect = (agent: SpecialistAgent) => {
    setInspectingAgent(agent);
  };

  const handleAttach = (agent: SpecialistAgent) => {
    setAttachingAgent(agent);
  };

  const handleAttachSuccess = (agent: SpecialistAgent) => {
    setNotification({
      message: `Successfully attached ${agent.name} to environment '${currentEnv?.name ?? "Current"}'.`,
      type: "success",
    });
    setTimeout(() => setNotification(null), 4000);
  };

  const attachedCount = store.graphNodes.filter((n) => n.role === "subagent").length;

  const gridClass = "mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

  const renderCard = (agent: SpecialistAgent) => {
    const status = nodeStatusById.get(agent.id);
    return (
      <AgentCard
        key={agent.id}
        agent={agent}
        isAttached={status !== undefined}
        status={status}
        onInspect={handleInspect}
        onAttach={handleAttach}
      />
    );
  };

  return (
    <div className={`flex min-h-0 flex-1 flex-col overflow-y-auto bg-background text-foreground ${className}`}>
      <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8">
        {/* Section header: title + description + Browse all */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-base font-semibold text-foreground">Agent library</h1>
            <p className="mt-1 max-w-xl text-xs text-muted-foreground">
              Pre-audited specialist agents ready for delegated spending authority. Attaching creates a
              structural connection with zero default spend.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={resetFilters} className="shrink-0">
            Browse all
          </Button>
        </div>

        {/* Search & category filter bar: search on its own line, chips wrap below */}
        <div className="mt-5">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search agents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-xs bg-card border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {categories.map((cat) => (
              <Button
                key={cat.id}
                variant={selectedCategory === cat.id ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setSelectedCategory(cat.id)}
                className="h-7 px-2.5 text-xs"
              >
                {cat.label}
              </Button>
            ))}

            <div className="mx-1 h-4 w-px bg-border" />

            <Button
              variant={showAttachedOnly ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setShowAttachedOnly(!showAttachedOnly)}
              aria-pressed={showAttachedOnly}
              className="h-7 border border-border px-2.5 text-xs"
            >
              Attached Only
            </Button>
          </div>
        </div>

        {/* Attach success banner */}
        {notification && (
          <div className="mt-4 flex items-center justify-between rounded-md border border-success/40 bg-success/10 p-3 text-xs text-success">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{notification.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setNotification(null)}
              className="text-[11px] text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              Dismiss
            </button>
          </div>
        )}

        {filteredAgents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Bot className="h-10 w-10 text-muted-foreground mb-3" />
            <h3 className="text-sm font-semibold text-foreground">No agents found</h3>
            <p className="mt-1 text-xs text-muted-foreground max-w-sm">
              No specialist agents matched your current filter or search criteria.
            </p>
            <Button variant="outline" size="sm" onClick={resetFilters} className="mt-4 h-7 text-xs">
              Reset Filters
            </Button>
          </div>
        ) : (
          <>
            {/* Attached to this environment */}
            {attachedAgents.length > 0 && (
              <section className="mt-8">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-foreground">
                    Attached to this environment
                  </h2>
                  <span className="text-xs text-muted-foreground">{attachedCount} active</span>
                </div>
                <div className={gridClass}>{attachedAgents.map(renderCard)}</div>
              </section>
            )}

            {/* Available in library */}
            <section className="mt-8">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">Available in library</h2>
                <span className="text-xs text-muted-foreground">
                  {availableAgents.length} agents
                </span>
              </div>
              {availableAgents.length > 0 ? (
                <div className={gridClass}>{availableAgents.map(renderCard)}</div>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">
                  Every matching agent is already attached to this environment.
                </p>
              )}
            </section>
          </>
        )}
      </div>

      {/* Detail Inspection Drawer */}
      <AgentDetailDrawer
        agent={inspectingAgent}
        isOpen={Boolean(inspectingAgent)}
        onClose={() => setInspectingAgent(null)}
        onAttach={handleAttach}
        isAttached={inspectingAgent ? nodeStatusById.has(inspectingAgent.id) : false}
      />

      {/* Attach Agent Dialog */}
      <AttachAgentDialog
        agent={attachingAgent}
        isOpen={Boolean(attachingAgent)}
        onClose={() => setAttachingAgent(null)}
        onSuccess={handleAttachSuccess}
      />
    </div>
  );
}
