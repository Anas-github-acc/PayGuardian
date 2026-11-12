"use client";

import * as React from "react";
import { Search, Bot, CheckCircle2, AlertCircle, RefreshCw, Plus } from "lucide-react";
import { useWorkspaceStore } from "../../app/lib/workspace-store";
import { useAgentLibrary } from "../../lib/api/hooks/use-agent-library";
import { type SpecialistAgent, type AgentCategory } from "./types";
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

  // Live backend hook fetching environment agents
  const { agents, catalogAgents = [], isLoading, error, refetch } = useAgentLibrary(currentEnv?.id);

  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedCategory, setSelectedCategory] = React.useState<AgentCategory>("all");
  const [showAttachedOnly, setShowAttachedOnly] = React.useState(false);

  // Modal / Drawer states
  const [inspectingAgent, setInspectingAgent] = React.useState<SpecialistAgent | null>(null);
  const [attachingAgent, setAttachingAgent] = React.useState<SpecialistAgent | null>(null);
  const [notification, setNotification] = React.useState<{
    message: string;
    type: "success" | "info";
  } | null>(null);

  // Attached agent ids + node status based on current workspace graph nodes
  const nodeStatusById = React.useMemo(() => {
    return new Map(store.graphNodes.map((n) => [n.id, n.status]));
  }, [store.graphNodes]);

  // Filtered agent list based on live environment agents
  const filteredAgents = React.useMemo(() => {
    return agents.filter((agent) => {
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
  }, [agents, selectedCategory, showAttachedOnly, searchQuery, nodeStatusById]);

  // Filtered catalog agents available to browse and attach
  const filteredCatalogAgents = React.useMemo(() => {
    return catalogAgents.filter((agent) => {
      if (selectedCategory !== "all" && agent.category !== selectedCategory) {
        return false;
      }
      const isAttached = agents.some(
        (a) =>
          a.name.toLowerCase() === agent.name.toLowerCase() ||
          (agent.specialty !== "custom" && a.specialty === agent.specialty),
      );
      if (showAttachedOnly && !isAttached) {
        return false;
      }
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
  }, [catalogAgents, selectedCategory, showAttachedOnly, searchQuery, agents]);

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

  const handleCreateChildAgent = () => {
    setAttachingAgent({
      id: `agent-child-${Date.now()}`,
      name: "Procurement Specialist",
      tagline: "Autonomous procurement child agent with bounded spending authority",
      description: "Registered child agent ready for delegated authority under a parent mandate.",
      specialty: "worker",
      role: "subagent",
      category: "procurement",
      authorityTier: "Tier 2: Autonomous Micro-Transactions",
      tierLevel: 2,
      recommendedBudgetMinor: 50000,
      currency: currentEnv?.currency ?? "USD",
      supportedRails: ["PayPal", "Simulation"],
      publisher: "Custom",
      avatarIcon: "network",
      permissions: ["Execute bounded transactions", "Check mandate authority"],
      samplePrompts: ["Procure resources within delegated mandate limit"],
      securityAudit: {
        auditedBy: "PayGuardian Security Engine",
        auditDate: new Date().toISOString().split("T")[0],
        cveVulnerabilities: 0,
        status: "certified",
        signatureHash: "0xsha256verified",
        sandboxTested: true,
      },
    });
  };

  const handleAttachSuccess = (agent: SpecialistAgent) => {
    setNotification({
      message: `Successfully attached ${agent.name} to environment '${currentEnv?.name ?? "Current"}'.`,
      type: "success",
    });
    void refetch();
    setTimeout(() => setNotification(null), 4000);
  };

  const gridClass = "mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

  const renderCard = (agent: SpecialistAgent) => {
    const status = nodeStatusById.get(agent.id);
    return (
      <AgentCard
        key={agent.id}
        agent={agent}
        isAttached={status !== undefined || agent.isAttached}
        status={status}
        onInspect={handleInspect}
        onAttach={handleAttach}
      />
    );
  };

  const renderCatalogCard = (agent: SpecialistAgent) => {
    const isAttached = agents.some(
      (a) =>
        a.name.toLowerCase() === agent.name.toLowerCase() ||
        (agent.specialty !== "custom" && a.specialty === agent.specialty),
    );
    const attachedAgent = agents.find(
      (a) =>
        a.name.toLowerCase() === agent.name.toLowerCase() ||
        (agent.specialty !== "custom" && a.specialty === agent.specialty),
    );
    const status = attachedAgent ? (nodeStatusById.get(attachedAgent.id) ?? "active") : undefined;

    return (
      <AgentCard
        key={agent.id}
        agent={agent}
        isAttached={isAttached}
        status={status}
        onInspect={handleInspect}
        onAttach={handleAttach}
      />
    );
  };

  return (
    <div
      className={`flex min-h-0 flex-1 flex-col overflow-y-auto bg-background text-foreground ${className}`}
    >
      <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8">
        {/* Section header: title + description + Actions */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-base font-semibold text-foreground">Agent library</h1>
            <p className="mt-1 max-w-xl text-xs text-muted-foreground">
              Pre-audited specialist agents ready for delegated spending authority. Attaching
              creates a structural connection with zero default spend.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={resetFilters} className="h-8 text-xs">
              Browse all
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleCreateChildAgent}
              className="h-8 text-xs"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Attach Agent
            </Button>
          </div>
        </div>

        {/* Search & category filter bar */}
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

        {/* Loading Skeleton */}
        {isLoading && (
          <div className="mt-8 space-y-6 animate-pulse" aria-label="Loading agents skeleton">
            <div className="flex items-center justify-between">
              <div className="h-5 w-48 rounded bg-muted/60" />
              <div className="h-4 w-20 rounded bg-muted/50" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="rounded-md border border-border bg-card p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <div className="h-9 w-9 rounded-md bg-muted/60" />
                    <div className="h-5 w-16 rounded bg-muted/50" />
                  </div>
                  <div className="h-4 w-3/4 rounded bg-muted/60" />
                  <div className="h-3 w-1/2 rounded bg-muted/40" />
                  <div className="h-10 w-full rounded bg-muted/30" />
                  <div className="border-t border-border pt-3 flex gap-2">
                    <div className="h-7 w-16 rounded bg-muted/50" />
                    <div className="h-7 w-16 rounded bg-muted/50" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error State with Retry */}
        {!isLoading && error && (
          <div className="mt-10 flex flex-col items-center justify-center rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center">
            <AlertCircle className="h-10 w-10 text-destructive mb-3" />
            <h3 className="text-sm font-semibold text-foreground">Failed to load agent library</h3>
            <p className="mt-1 text-xs text-muted-foreground max-w-sm">
              {error.message || "Could not retrieve registered agents from the gateway."}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refetch()}
              className="mt-4 h-8 text-xs inline-flex items-center gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry Connection
            </Button>
          </div>
        )}

        {/* Main Content Area */}
        {!isLoading && !error && (
          <>
            {filteredAgents.length === 0 ? (
              <div className="mt-10 flex flex-col items-center justify-center py-12 text-center rounded-lg border border-dashed border-border bg-card/40 p-8">
                <Bot className="h-10 w-10 text-muted-foreground mb-3" />
                <h3 className="text-sm font-semibold text-foreground">No agents found</h3>
                <p className="mt-1 text-xs text-muted-foreground max-w-sm">
                  {searchQuery
                    ? "No specialist agents matched your current filter or search criteria."
                    : "No agents registered in this environment yet. Click 'Attach Agent' to register a child agent."}
                </p>
                {searchQuery ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetFilters}
                    className="mt-4 h-7 text-xs"
                  >
                    Reset Filters
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleCreateChildAgent}
                    className="mt-4 h-8 text-xs"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Attach Agent
                  </Button>
                )}
              </div>
            ) : (
              /* Attached to this environment section */
              <section className="mt-8">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-foreground">
                    Attached to this environment
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    {filteredAgents.length} registered
                  </span>
                </div>
                <div className={gridClass}>{filteredAgents.map(renderCard)}</div>
              </section>
            )}

            {/* Available in library (Catalog) */}
            <section className="mt-10 border-t border-border pt-8">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">
                    Available in library (Catalog)
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Certified specialist agent templates ready to be attached to your environment.
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {filteredCatalogAgents.length} available
                </span>
              </div>
              {filteredCatalogAgents.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-card/30 p-6 text-center">
                  <p className="text-xs text-muted-foreground">
                    No catalog agents matched the current filter.
                  </p>
                </div>
              ) : (
                <div className={gridClass}>{filteredCatalogAgents.map(renderCatalogCard)}</div>
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
        isAttached={
          inspectingAgent
            ? nodeStatusById.has(inspectingAgent.id) || inspectingAgent.isAttached
            : false
        }
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
