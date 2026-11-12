"use client";

import * as React from "react";
import {
  Layers,
  ArrowRight,
  Sparkles,
  Workflow,
  KeyRound,
  FileCode2,
  Loader2,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { workspaceStore } from "../../app/lib/workspace-store";
import { useEnvironments } from "../../lib/api/hooks/use-environments";

export interface ZeroEnvironmentsPresentationProps {
  className?: string;
  onEnvironmentCreated?: () => void;
}

export function ZeroEnvironmentsPresentation({
  className,
  onEnvironmentCreated,
}: ZeroEnvironmentsPresentationProps) {
  const { createAndBootstrap, refetch, error: hookError } = useEnvironments();
  const [isBootstrapping, setIsBootstrapping] = React.useState(false);
  const [bootstrapStatus, setBootstrapStatus] = React.useState<string>("");
  const [bootstrapError, setBootstrapError] = React.useState<string | null>(null);
  const [activePillarIndex, setActivePillarIndex] = React.useState(0);

  const handleOpenWizard = () => {
    workspaceStore.setCreateWizardOpen(true);
  };

  const handleQuickstartBootstrap = async () => {
    setIsBootstrapping(true);
    setBootstrapError(null);
    try {
      setBootstrapStatus("1/3 Initializing isolated tenant environment...");
      // Delay briefly for visual polish and user comprehension
      await new Promise((r) => setTimeout(r, 400));

      setBootstrapStatus("2/3 Registering root orchestrator & cryptographic keys...");
      await new Promise((r) => setTimeout(r, 400));

      setBootstrapStatus("3/3 Bounding root authority mandate & child sub-agents...");
      await createAndBootstrap({
        name: "Travel & Hospitality",
        purpose: "Autonomous flight booking, hotel procurement, and itinerary settlement",
        currency: "USD",
        budgetLimitMinor: 1000000, // $10,000.00
        approvalThresholdMinor: 50000, // $500.00
        maxDelegationDepth: 2,
        allowedRails: ["PayPal", "Simulation"],
        type: "sandbox",
        rootAgentName: "Main Travel Orchestrator",
        bootstrapChildAgents: true,
      });

      onEnvironmentCreated?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to bootstrap environment";
      setBootstrapError(msg);
    } finally {
      setIsBootstrapping(false);
      setBootstrapStatus("");
    }
  };

  const architecturalPillars = [
    {
      id: "isolation",
      icon: Layers,
      title: "Airtight Tenant Isolation",
      subtitle: "Absolute Boundary Enforcement",
      tagline: "Prevent accidental debit leaks and cross-agent contamination.",
      description:
        "Every environment acts as a sovereign cryptographic cell. Agents, credentials, transaction ledgers, and simulation logs are strictly partitioned. Sandbox testing will never leak test funds or execution state to production payment rails.",
      specs: [
        { label: "Tenant Partition", value: "Cryptographic boundary" },
        { label: "State Leakage", value: "Zero (Strict Isolation)" },
        { label: "Credential Scope", value: "Environment-bound" },
      ],
      accentGlow: "from-blue-500/20 via-blue-500/5 to-transparent",
      borderColor: "border-blue-500/30",
      iconColor: "text-blue-400",
    },
    {
      id: "delegation",
      icon: Workflow,
      title: "Hierarchical Delegation Trees",
      subtitle: "Bounded Autonomous Authority",
      tagline: "Autonomous LLMs must never receive direct API access to funds.",
      description:
        "Humans issue the root mandate with an immutable ceiling and expiry. Orchestrator agents can only sub-delegate authority down a depth-bounded directed acyclic graph (depth ≤ 2). Subagents cannot allocate more authority than their parent holds.",
      specs: [
        { label: "Max Delegation Depth", value: "2 Tiers" },
        { label: "Budget Bound", value: "Monotonically Decreasing" },
        { label: "Revocation", value: "Cascade Instant" },
      ],
      accentGlow: "from-emerald-500/20 via-emerald-500/5 to-transparent",
      borderColor: "border-emerald-500/30",
      iconColor: "text-emerald-400",
    },
    {
      id: "enforcement",
      icon: KeyRound,
      title: "Autonomous Limits & Passkey Escalation",
      subtitle: "Dual-Speed Security Engine",
      tagline: "Sub-millisecond micro-spend with instant human biometric halts.",
      description:
        "Routine payments within configured boundaries execute autonomously in milliseconds. High-value transactions or anomalous requests halt execution immediately, demanding cryptographic WebAuthn/FIDO2 passkey biometric approval from human operators.",
      specs: [
        { label: "Low-Risk Latency", value: "< 15ms Autonomous" },
        { label: "Threshold Trigger", value: "WebAuthn / Passkey" },
        { label: "Human-in-the-Loop", value: "Hardware Bound" },
      ],
      accentGlow: "from-amber-500/20 via-amber-500/5 to-transparent",
      borderColor: "border-amber-500/30",
      iconColor: "text-amber-400",
    },
    {
      id: "ledger",
      icon: FileCode2,
      title: "Double-Entry Ledger & Chain Audit",
      subtitle: "Mathematical Zero-Sum Invariants",
      tagline: "No floating point drift. Non-repudiable rolling digests.",
      description:
        "Every authorization, reservation, capture, and refund is logged in integer minor units (cents) within a double-entry ledger. All transactions contribute to a continuous rolling SHA-256 digest, rendering historical audits tamper-evident.",
      specs: [
        { label: "Arithmetic Invariant", value: "Available + Reserved + Spent" },
        { label: "Unit Standard", value: "Integer Minor Units" },
        { label: "Tamper Proof", value: "Rolling SHA-256 Chaining" },
      ],
      accentGlow: "from-zinc-400/20 via-zinc-400/5 to-transparent",
      borderColor: "border-zinc-500/30",
      iconColor: "text-zinc-200",
    },
  ];

  return (
    <div
      className={cn(
        "relative min-h-[calc(100vh-3.5rem)] w-full overflow-y-auto bg-black text-white selection:bg-zinc-800 selection:text-white px-4 py-10 sm:px-8 lg:px-12",
        className,
      )}
    >
      {/* Background Decorative Gradient Orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 h-[500px] w-[900px] rounded-full bg-gradient-to-b from-blue-600/15 via-emerald-600/10 to-transparent blur-[120px]" />
        <div className="absolute bottom-10 left-10 h-72 w-72 rounded-full bg-emerald-500/5 blur-[90px]" />
        <div className="absolute bottom-10 right-10 h-72 w-72 rounded-full bg-blue-500/5 blur-[90px]" />
      </div>

      <div className="relative mx-auto max-w-6xl space-y-12">
        {/* Top Header Badge */}
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950/80 px-3.5 py-1 text-xs text-zinc-300 backdrop-blur-md shadow-inner">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-400">
              Gateway Authority Engine · Setup Required
            </span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white max-w-4xl leading-[1.12]">
            Isolated Environments.{" "}
            <span className="bg-gradient-to-r from-zinc-200 via-zinc-400 to-zinc-600 bg-clip-text text-transparent">
              Bounded Delegation.
            </span>{" "}
            Zero Runaway Spend.
          </h1>

          <p className="max-w-2xl text-base sm:text-lg text-zinc-400 leading-relaxed">
            Autonomous AI agents cannot touch payment rails directly. PayGuardian creates strict
            cryptographic sandbox environments where financial authority is monotonically bounded
            and verified before every transaction.
          </p>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <Button
              size="lg"
              onClick={handleOpenWizard}
              className="group relative h-12 gap-2.5 rounded-xl bg-white px-6 font-medium text-black transition-all duration-200 hover:bg-zinc-200 hover:shadow-lg hover:shadow-white/10 active:scale-[0.99]"
            >
              <Sparkles className="h-4 w-4 text-zinc-800 transition-transform group-hover:rotate-12" />
              <span>Create First Environment</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>

            <Button
              size="lg"
              variant="outline"
              disabled={isBootstrapping}
              onClick={handleQuickstartBootstrap}
              className="h-12 gap-2.5 rounded-xl border-zinc-800 bg-zinc-950/70 px-6 font-medium text-zinc-200 backdrop-blur-md transition-all duration-200 hover:border-zinc-700 hover:bg-zinc-900 active:scale-[0.99]"
            >
              {isBootstrapping ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                  <span>{bootstrapStatus || "Bootstrapping..."}</span>
                </>
              ) : (
                <>
                  <Layers className="h-4 w-4 text-emerald-400" />
                  <span>1-Click Sandbox Deployment (Travel & Hospitality)</span>
                </>
              )}
            </Button>
          </div>

          {/* Diagnostic or Bootstrap Errors */}
          {(bootstrapError || hookError) && (
            <div className="mt-4 flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-950/20 px-4 py-2.5 text-xs text-red-300">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
              <span>{bootstrapError || hookError}</span>
              <button
                type="button"
                onClick={() => refetch()}
                className="ml-auto inline-flex items-center gap-1 font-mono text-[11px] text-zinc-400 underline hover:text-white"
              >
                <RotateCcw className="h-3 w-3" /> Retry
              </button>
            </div>
          )}
        </div>

        {/* Interactive Visual Authority Flow Diagram */}
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
          <div className="flex items-center justify-between pb-6 border-b border-zinc-800/60">
            <div>
              <p className="font-mono text-xs uppercase tracking-wider text-emerald-400">
                Cryptographic Architecture Flow
              </p>
              <h2 className="text-lg font-semibold text-white">
                How PayGuardian Bounds Autonomous AI Execution
              </h2>
            </div>
            <Badge
              variant="secondary"
              className="hidden sm:inline-flex border-zinc-800 text-zinc-400 font-mono text-[11px]"
            >
              FIDO2 · DAG ≤ 2 · Minor Units
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-6">
            <div className="flex flex-col justify-between rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 transition-all duration-200 hover:border-zinc-700">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800 font-mono text-xs font-semibold text-zinc-300">
                    1
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                    Human Authority
                  </span>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Operator defines an isolated Environment, bounding max budget ($10k) and setting
                  passkey verification thresholds.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-zinc-800/60 font-mono text-[10px] text-zinc-500">
                FIDO2 WebAuthn Signature
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 transition-all duration-200 hover:border-zinc-700">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500/20 font-mono text-xs font-semibold text-blue-400">
                    2
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-wider text-blue-300">
                    Root Mandate
                  </span>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Root Personal Orchestrator holds the master spending mandate. Can only
                  sub-delegate fractions down the DAG.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-zinc-800/60 font-mono text-[10px] text-blue-400/80">
                Max Delegation Depth: 2
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 transition-all duration-200 hover:border-zinc-700">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 font-mono text-xs font-semibold text-emerald-400">
                    3
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
                    Subagent Execution
                  </span>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Specialist subagents (e.g. Flight, Hotel) receive scoped child mandates ($4,000
                  max) strictly bounded by role.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-zinc-800/60 font-mono text-[10px] text-emerald-400/80">
                Monotonically Decreasing Limits
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 transition-all duration-200 hover:border-zinc-700">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800 font-mono text-xs font-semibold text-zinc-300">
                    4
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                    Gateway Enforcement
                  </span>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Gateway verifies signature, checks double-entry balance, confirms approvals, and
                  settles to rails (PayPal/Sim).
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-zinc-800/60 font-mono text-[10px] text-zinc-400">
                SHA-256 Rolling Digest Chain
              </div>
            </div>
          </div>
        </div>

        {/* 4 Architectural Pillars: Interactive Feature Matrix */}
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <p className="font-mono text-xs uppercase tracking-wider text-zinc-500">
                Core Architectural Pillars
              </p>
              <h2 className="text-xl sm:text-2xl font-semibold text-white">
                Why Environment Isolation & Delegation Are Critical
              </h2>
            </div>
            <span className="text-xs text-zinc-400 font-mono">
              Click a pillar to inspect formal verification guarantees
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {architecturalPillars.map((pillar, idx) => {
              const Icon = pillar.icon;
              const isSelected = activePillarIndex === idx;

              return (
                <div
                  key={pillar.id}
                  onClick={() => setActivePillarIndex(idx)}
                  className={cn(
                    "group relative cursor-pointer flex flex-col justify-between rounded-xl border p-5 transition-all duration-300 select-none",
                    isSelected
                      ? cn("bg-zinc-900/90 shadow-xl", pillar.borderColor)
                      : "border-zinc-800/80 bg-zinc-950/60 hover:border-zinc-700 hover:bg-zinc-900/40",
                  )}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 transition-colors",
                          pillar.iconColor,
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className="font-mono text-[11px] text-zinc-500">0{idx + 1}</span>
                    </div>

                    <div>
                      <h3 className="font-semibold text-zinc-100 text-sm group-hover:text-white transition-colors">
                        {pillar.title}
                      </h3>
                      <p className="text-xs text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                        {pillar.tagline}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-zinc-800/60 flex items-center justify-between text-xs font-mono">
                    <span className="text-zinc-500">{pillar.specs[0]?.label}</span>
                    <span className="text-zinc-300 font-medium">{pillar.specs[0]?.value}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selected Pillar Deep Dive Drawer */}
          {architecturalPillars[activePillarIndex] && (
            <div className="relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/90 p-6 sm:p-8 backdrop-blur-md">
              <div
                className={cn(
                  "pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-to-bl blur-[80px]",
                  architecturalPillars[activePillarIndex]?.accentGlow,
                )}
              />

              <div className="relative space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="font-mono text-xs uppercase tracking-wider text-zinc-400">
                      Pillar 0{activePillarIndex + 1} ·{" "}
                      {architecturalPillars[activePillarIndex]?.subtitle}
                    </span>
                    <h3 className="text-xl font-bold text-white mt-0.5">
                      {architecturalPillars[activePillarIndex]?.title}
                    </h3>
                  </div>

                  <Button
                    size="sm"
                    onClick={handleOpenWizard}
                    className="gap-1.5 rounded-lg bg-zinc-100 text-black text-xs font-medium hover:bg-white"
                  >
                    <span>Configure in Wizard</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <p className="text-sm text-zinc-300 max-w-3xl leading-relaxed">
                  {architecturalPillars[activePillarIndex]?.description}
                </p>

                {/* Specs Pill Matrix */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3">
                  {architecturalPillars[activePillarIndex]?.specs.map((s, i) => (
                    <div
                      key={i}
                      className="rounded-lg border border-zinc-800/80 bg-zinc-900/60 px-4 py-2.5 font-mono text-xs"
                    >
                      <span className="text-zinc-500 block text-[10px] uppercase tracking-wider">
                        {s.label}
                      </span>
                      <span className="text-zinc-200 font-semibold mt-0.5 block">{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Callout / Footer Launchpad */}
        <div className="rounded-xl border border-zinc-800/60 bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-center sm:text-left">
            <h4 className="font-semibold text-white text-base">
              Ready to deploy your first bounded authority boundary?
            </h4>
            <p className="text-xs text-zinc-400 max-w-xl leading-relaxed">
              Define your root spending ceiling, assign agent delegation keys, and experience
              autonomous payments with verifiable cryptographic containment.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Button
              onClick={handleOpenWizard}
              className="h-10 gap-2 rounded-lg bg-white px-5 text-xs font-semibold text-black hover:bg-zinc-200"
            >
              <span>Launch Setup Wizard</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
