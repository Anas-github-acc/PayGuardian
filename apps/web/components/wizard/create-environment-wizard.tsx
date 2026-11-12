"use client";

import * as React from "react";
import {
  Shield,
  FileCheck,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  TestTube2,
  ShieldCheck,
  AlertCircle,
  Clock,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { formatMinorUnits, parseMajorToMinor, getCurrencySymbol } from "../../app/lib/currency";
import { useWorkspaceStore, workspaceStore, type Environment } from "../../app/lib/workspace-store";
import { apiClient } from "../../lib/api/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { Button } from "../ui/button";

export interface CreateEnvironmentWizardProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onCreated?: (env: Environment) => void;
}

type WizardStep = 1 | 2 | 3 | 4 | 5;

export function CreateEnvironmentWizard({
  open: controlledOpen,
  onOpenChange,
  onCreated,
}: CreateEnvironmentWizardProps) {
  const { isCreateWizardOpen } = useWorkspaceStore();
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : isCreateWizardOpen;

  const [step, setStep] = React.useState<WizardStep>(1);

  // Step 1: Identity
  const [name, setName] = React.useState("Procurement & Travel");
  const [slug, setSlug] = React.useState("procurement-travel");
  const [envType, setEnvType] = React.useState<"sandbox" | "production">("sandbox");
  const [purpose, setPurpose] = React.useState(
    "Autonomous flight booking, vendor procurement, and travel logistics",
  );

  // Step 2: Root Mandate
  const [currency, setCurrency] = React.useState("USD");
  const [budgetString, setBudgetString] = React.useState("10000"); // $10,000.00
  const [expiryPreset, setExpiryPreset] = React.useState<"7d" | "30d" | "90d" | "custom">("30d");
  const [customExpiry, setCustomExpiry] = React.useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split("T")[0]!;
  });

  // Step 3: Guardrails
  const [allowedRails, setAllowedRails] = React.useState<string[]>(["PayPal", "Simulation"]);
  const [maxPerActionString, setMaxPerActionString] = React.useState("500"); // $500.00
  const [approvalRequired] = React.useState(true);
  const [approvalThresholdString, setApprovalThresholdString] = React.useState("1000"); // $1,000.00
  const [maxDelegationDepth, setMaxDelegationDepth] = React.useState<number>(2);

  // Step 4: Consent
  const [consentConfirmed, setConsentConfirmed] = React.useState(false);

  // Submission State
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Auto-slugify on name change
  const handleNameChange = (val: string) => {
    setName(val);
    const generatedSlug = val
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    setSlug(generatedSlug);
  };

  const handleClose = (newOpen: boolean) => {
    if (!newOpen) {
      setStep(1);
      setErrorMessage(null);
      setConsentConfirmed(false);
    }
    if (isControlled) {
      onOpenChange?.(newOpen);
    } else {
      workspaceStore.setCreateWizardOpen(newOpen);
    }
  };

  // Safe minor unit calculations
  const budgetLimitMinor = React.useMemo(() => {
    try {
      return parseMajorToMinor(budgetString, currency);
    } catch {
      return 0;
    }
  }, [budgetString, currency]);

  const approvalThresholdMinor = React.useMemo(() => {
    try {
      return parseMajorToMinor(approvalThresholdString, currency);
    } catch {
      return 0;
    }
  }, [approvalThresholdString, currency]);

  // Expiry date calculation
  const calculatedExpiryDate = React.useMemo(() => {
    if (expiryPreset === "custom" && customExpiry) {
      return new Date(customExpiry).toISOString();
    }
    const daysMap = { "7d": 7, "30d": 30, "90d": 90 };
    const days = daysMap[expiryPreset as "7d" | "30d" | "90d"] ?? 30;
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString();
  }, [expiryPreset, customExpiry]);

  const formattedExpiryDisplay = React.useMemo(() => {
    try {
      return new Date(calculatedExpiryDate).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return calculatedExpiryDate;
    }
  }, [calculatedExpiryDate]);

  // Dynamic Consent Generation (Compiled strictly from mandate parameters)
  const dynamicConsentText = React.useMemo(() => {
    const formattedBudget = formatMinorUnits(budgetLimitMinor, currency);
    const formattedThreshold = formatMinorUnits(approvalThresholdMinor, currency);
    const railsDesc = allowedRails.length > 0 ? allowedRails.join(" and ") : "PayPal";

    return `By proceeding, you grant bounded cryptographic authority to environment '${name || "Unnamed"}' to initiate payments up to ${formattedBudget} via ${railsDesc}. It may delegate sub-mandates up to ${maxDelegationDepth} levels deep to specialist agents. Any single action exceeding ${formattedThreshold} strictly requires explicit human cryptographic sign-off. Authority expires on ${formattedExpiryDisplay}. All financial operations are immutably logged to the gateway audit ledger with cryptographic zero-knowledge chain verification.`;
  }, [
    name,
    budgetLimitMinor,
    currency,
    allowedRails,
    maxDelegationDepth,
    approvalThresholdMinor,
    formattedExpiryDisplay,
  ]);

  const handleNextStep = () => {
    setErrorMessage(null);
    if (step === 1) {
      if (!name.trim()) {
        setErrorMessage("Please enter an environment name.");
        return;
      }
      if (!slug.trim()) {
        setErrorMessage("Please enter an environment slug identifier.");
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (budgetLimitMinor <= 0) {
        setErrorMessage("Budget limit must be greater than zero.");
        return;
      }
      setStep(3);
    } else if (step === 3) {
      if (approvalRequired && approvalThresholdMinor <= 0) {
        setErrorMessage("Please set a positive approval threshold.");
        return;
      }
      setStep(4);
    } else if (step === 4) {
      if (!consentConfirmed) {
        setErrorMessage("You must explicitly review and authorize the consent statement.");
        return;
      }
      setStep(5);
    }
  };

  const handleAuthorizeAndCreate = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      // 1. Create Environment in Gateway backend
      const createdEnv = await apiClient.environments.create({
        name,
        purpose,
        currency,
        budgetLimitMinor,
      });

      if (!createdEnv?.id) {
        throw new Error("Gateway failed to return a valid environment ID");
      }

      // 2. Register Root Personal Agent in this newly created environment
      const rootAgent = await apiClient.agents.createRoot(createdEnv.id, {
        name: "Personal Agent",
        capabilities: ["delegate", "simulate", "spend", "reserve"],
      });

      // 3. Create Root Mandate bound to Root Agent
      await apiClient.mandates.createRoot(createdEnv.id, {
        holderAgentId: rootAgent.id,
        budgetLimitMinor,
        currency,
        permittedActions: ["*"],
        expiresAt: calculatedExpiryDate,
        canDelegate: true,
        maxDelegationDepth,
        approvalRequired: true,
      });

      // 4. Assemble confirmed Environment object with verified backend ID
      const newEnv: Environment = {
        id: createdEnv.id,
        name: createdEnv.name || name,
        slug,
        purpose: createdEnv.purpose || purpose,
        currency: createdEnv.currency || currency,
        budgetLimitMinor: createdEnv.budgetLimitMinor ?? budgetLimitMinor,
        spentMinor: 0,
        reservedMinor: 0,
        availableMinor: createdEnv.budgetLimitMinor ?? budgetLimitMinor,
        status: "active",
        type: envType,
        createdAt: createdEnv.createdAt || new Date().toISOString(),
        expiresAt: calculatedExpiryDate,
        agentCount: 1, // Root Personal Agent
        pendingApprovalsCount: 0,
        maxDelegationDepth,
        approvalThresholdMinor,
        allowedRails,
        consentStatement: dynamicConsentText,
      };

      // Add to workspace store and switch into it
      workspaceStore.addEnvironment(newEnv);
      onCreated?.(newEnv);
      handleClose(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create environment on Gateway";
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepTitles = [
    { number: 1, title: "Identity & Type" },
    { number: 2, title: "Root Mandate" },
    { number: 3, title: "Guardrails" },
    { number: 4, title: "Dynamic Consent" },
    { number: 5, title: "Confirm & Deploy" },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl p-0 bg-zinc-950 border border-zinc-800 rounded-2xl text-white shadow-2xl overflow-hidden top-shade">
        {/* ─── Header matching Workspace Section ─── */}
        <DialogHeader className="px-6 py-5 border-b border-zinc-800/80 bg-zinc-950 text-left pr-12 space-y-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 inline-block animate-pulse shrink-0" />
            <DialogTitle className="text-base font-semibold tracking-tight text-white flex items-center gap-2">
              <span>Workspace</span>
              <span className="text-zinc-600 font-normal">/</span>
              <span className="text-zinc-300 font-semibold">Create Environment</span>
            </DialogTitle>
          </div>

          <DialogDescription className="mt-1 text-xs text-zinc-400">
            Initialize an isolated cryptographic tenant cell and authorize root spending authority.
          </DialogDescription>

          {/* Connected Stepper Progress matching Workspace navigation */}
          <div className="mt-4 space-y-2 pt-1">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="font-medium text-zinc-400">
                Step {step} of 5 ·{" "}
                <span className="text-zinc-200">{stepTitles[step - 1]?.title}</span>
              </span>
              <span className="font-semibold text-zinc-300 font-mono">{step * 20}%</span>
            </div>

            <div className="grid grid-cols-5 gap-1.5">
              {stepTitles.map((s) => {
                const isPast = s.number < step;
                const isCurrent = s.number === step;

                return (
                  <div key={s.number} className="flex flex-col gap-1.5">
                    <div
                      className={cn(
                        "h-1 w-full rounded-full transition-all duration-200",
                        isCurrent && "bg-white shadow-[0_0_8px_rgba(255,255,255,0.4)]",
                        isPast && "bg-zinc-500",
                        !isPast && !isCurrent && "bg-zinc-800",
                      )}
                    />
                    <span
                      className={cn(
                        "text-[9px] font-mono truncate hidden sm:block",
                        isCurrent
                          ? "text-white font-medium"
                          : isPast
                            ? "text-zinc-400"
                            : "text-zinc-600",
                      )}
                    >
                      {s.number}. {s.title}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </DialogHeader>

        {/* ─── Body Content ─── */}
        <div className="px-6 py-5 max-h-[60vh] overflow-y-auto space-y-5 bg-zinc-950/60">
          {/* Step 1: Identity & Isolation */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-zinc-300 block mb-1.5">
                  Environment Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Procurement & Travel"
                  className="w-full h-10 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3.5 text-xs text-white placeholder:text-zinc-600 transition-colors focus:border-zinc-600 focus:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-600"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-300 block mb-1.5">
                  Slug Identifier
                </label>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="procurement-travel"
                  className="w-full h-10 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3.5 font-mono text-xs text-white placeholder:text-zinc-600 transition-colors focus:border-zinc-600 focus:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-600"
                />
                <span className="text-[11px] font-mono text-zinc-500 mt-1 block">
                  Scoped route prefix: /e/{slug || "env"}
                </span>
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-300 block mb-2">
                  Environment Isolation Type
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Sandbox Card */}
                  <div
                    onClick={() => setEnvType("sandbox")}
                    className={cn(
                      "cursor-pointer rounded-xl border p-4 transition-all duration-150 select-none",
                      envType === "sandbox"
                        ? "border-zinc-600 bg-zinc-900/90 shadow-sm ring-1 ring-zinc-700"
                        : "border-zinc-800/80 bg-zinc-900/30 hover:border-zinc-700 hover:bg-zinc-900/60",
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-xs text-white flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-zinc-800 border border-zinc-700 text-zinc-300">
                          <TestTube2 className="h-3.5 w-3.5" />
                        </div>
                        Sandbox
                      </span>
                      <span className="font-mono text-[10px] rounded border border-zinc-800 bg-zinc-900/80 px-2 py-0.5 text-zinc-400">
                        Simulated
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      Safe mock rails and synthetic attack simulation with zero real financial risk.
                    </p>
                  </div>

                  {/* Production Card */}
                  <div
                    onClick={() => setEnvType("production")}
                    className={cn(
                      "cursor-pointer rounded-xl border p-4 transition-all duration-150 select-none",
                      envType === "production"
                        ? "border-blue-500/60 bg-blue-950/20 shadow-sm ring-1 ring-blue-500/40"
                        : "border-zinc-800/80 bg-zinc-900/30 hover:border-zinc-700 hover:bg-zinc-900/60",
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-xs text-white flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-950 border border-blue-900/60 text-blue-400">
                          <ShieldCheck className="h-3.5 w-3.5" />
                        </div>
                        Production
                      </span>
                      <span className="font-mono text-[10px] rounded border border-blue-900/60 bg-blue-950/40 px-2 py-0.5 text-blue-400">
                        Live Rails
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      Live settlement via PayPal API with real cardholder transactions and WebAuthn.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-300 block mb-1.5">
                  Primary Purpose & Scope
                </label>
                <textarea
                  rows={2}
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="Describe bounded tasks agents in this environment will execute..."
                  className="w-full resize-none rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 text-xs text-white placeholder:text-zinc-600 transition-colors focus:border-zinc-600 focus:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-600"
                />
              </div>
            </div>
          )}

          {/* Step 2: Root Mandate */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-zinc-300 block mb-1.5">Currency</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full h-10 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 text-xs font-medium text-white transition-colors focus:border-zinc-600 focus:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-600 cursor-pointer"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="JPY">JPY (¥)</option>
                    <option value="INR">INR (₹)</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="text-xs font-medium text-zinc-300 block mb-1.5">
                    Root Spending Ceiling
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-xs text-zinc-400">
                      {getCurrencySymbol(currency)}
                    </span>
                    <input
                      type="text"
                      value={budgetString}
                      onChange={(e) => setBudgetString(e.target.value)}
                      placeholder="10,000"
                      className="w-full h-10 rounded-lg border border-zinc-800 bg-zinc-900/60 pl-8 pr-3 font-mono text-xs tabular-nums text-white placeholder:text-zinc-600 transition-colors focus:border-zinc-600 focus:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-600"
                    />
                  </div>
                </div>
              </div>

              {/* KPI Strip style integer breakdown */}
              <div className="grid grid-cols-2 gap-px rounded-xl border border-zinc-800 bg-zinc-900/60 p-px shadow-sm">
                <div className="flex flex-col justify-between rounded-l-lg bg-zinc-950 p-3.5">
                  <span className="text-[11px] text-zinc-400">Deterministic Ceiling</span>
                  <div className="mt-1">
                    <div className="text-lg font-bold tracking-tight text-white font-mono tabular-nums">
                      {formatMinorUnits(budgetLimitMinor, currency)}
                    </div>
                    <p className="mt-0.5 text-[10px] text-zinc-500 font-mono">
                      Major currency allocation
                    </p>
                  </div>
                </div>

                <div className="flex flex-col justify-between rounded-r-lg bg-zinc-950 p-3.5">
                  <span className="text-[11px] text-zinc-400">Integer Minor Units</span>
                  <div className="mt-1">
                    <div className="text-lg font-bold tracking-tight text-zinc-300 font-mono tabular-nums">
                      {budgetLimitMinor.toLocaleString()}{" "}
                      {currency === "JPY" ? "yen" : "minor units"}
                    </div>
                    <p className="mt-0.5 text-[10px] text-zinc-500 font-mono">
                      Zero floating-point drift
                    </p>
                  </div>
                </div>
              </div>

              {/* Expiry Presets */}
              <div>
                <label className="text-xs font-medium text-zinc-300 block mb-1.5">
                  Authority Validity Window
                </label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {(["7d", "30d", "90d", "custom"] as const).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setExpiryPreset(preset)}
                      className={cn(
                        "rounded-lg border py-2 text-xs font-medium transition-all cursor-pointer text-center select-none",
                        expiryPreset === preset
                          ? "bg-zinc-800 text-white border-zinc-700 shadow-sm"
                          : "border-zinc-800/80 bg-zinc-900/40 text-zinc-400 hover:text-white hover:bg-zinc-900/80",
                      )}
                    >
                      {preset === "7d" && "7 Days"}
                      {preset === "30d" && "30 Days"}
                      {preset === "90d" && "90 Days"}
                      {preset === "custom" && "Custom"}
                    </button>
                  ))}
                </div>

                {expiryPreset === "custom" ? (
                  <input
                    type="date"
                    value={customExpiry}
                    onChange={(e) => setCustomExpiry(e.target.value)}
                    className="w-full h-10 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 text-xs font-mono text-white transition-colors focus:border-zinc-600 focus:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-600"
                  />
                ) : (
                  <div className="flex items-center gap-2 rounded-lg border border-zinc-800/60 bg-zinc-900/30 px-3 py-2 text-xs text-zinc-400 font-mono">
                    <Clock className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                    <span>
                      Authority expires on:{" "}
                      <strong className="text-zinc-200">{formattedExpiryDisplay}</strong>
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Guardrails */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-zinc-300 block mb-1.5">
                  Authorized Payment Rails
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-3 rounded-lg border border-zinc-800/80 bg-zinc-900/40 hover:border-zinc-700 cursor-pointer transition-colors select-none">
                    <input
                      type="checkbox"
                      checked={allowedRails.includes("PayPal")}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setAllowedRails([...allowedRails, "PayPal"]);
                        } else {
                          setAllowedRails(allowedRails.filter((r) => r !== "PayPal"));
                        }
                      }}
                      className="size-4 rounded border-zinc-700 bg-zinc-800 text-white accent-white cursor-pointer"
                    />
                    <div className="space-y-0.5">
                      <div className="text-xs font-medium text-white">PayPal Rails</div>
                      <div className="text-[11px] text-zinc-500">
                        Orders & Authorizations API v2 with idempotent capture
                      </div>
                    </div>
                    <span className="ml-auto font-mono text-[10px] text-zinc-400 rounded border border-zinc-800 px-2 py-0.5 bg-zinc-900/80">
                      Standard
                    </span>
                  </label>

                  {envType === "sandbox" && (
                    <label className="flex items-center gap-3 p-3 rounded-lg border border-zinc-800/80 bg-zinc-900/40 hover:border-zinc-700 cursor-pointer transition-colors select-none">
                      <input
                        type="checkbox"
                        checked={allowedRails.includes("Simulation")}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setAllowedRails([...allowedRails, "Simulation"]);
                          } else {
                            setAllowedRails(allowedRails.filter((r) => r !== "Simulation"));
                          }
                        }}
                        className="size-4 rounded border-zinc-700 bg-zinc-800 text-white accent-white cursor-pointer"
                      />
                      <div className="space-y-0.5">
                        <div className="text-xs font-medium text-white">Simulation Mock Rail</div>
                        <div className="text-[11px] text-zinc-500">
                          In-memory synthetic payment simulator for attack vectors
                        </div>
                      </div>
                      <span className="ml-auto font-mono text-[10px] text-zinc-400 rounded border border-zinc-800 px-2 py-0.5 bg-zinc-900/80">
                        Simulated
                      </span>
                    </label>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-zinc-300 block mb-1.5">
                    Max Per-Action Cap
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-xs text-zinc-400">
                      {getCurrencySymbol(currency)}
                    </span>
                    <input
                      type="text"
                      value={maxPerActionString}
                      onChange={(e) => setMaxPerActionString(e.target.value)}
                      placeholder="500"
                      className="w-full h-10 rounded-lg border border-zinc-800 bg-zinc-900/60 pl-8 pr-3 font-mono text-xs tabular-nums text-white placeholder:text-zinc-600 transition-colors focus:border-zinc-600 focus:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-zinc-300 block mb-1.5">
                    Human Approval Threshold
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-xs text-zinc-400">
                      {getCurrencySymbol(currency)}
                    </span>
                    <input
                      type="text"
                      value={approvalThresholdString}
                      onChange={(e) => setApprovalThresholdString(e.target.value)}
                      placeholder="1,000"
                      className="w-full h-10 rounded-lg border border-zinc-800 bg-zinc-900/60 pl-8 pr-3 font-mono text-xs tabular-nums text-white placeholder:text-zinc-600 transition-colors focus:border-zinc-600 focus:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-600"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-300 block mb-1.5">
                  Maximum Delegation Depth (Hard Invariant: Depth ≤ 2)
                </label>
                <select
                  value={maxDelegationDepth}
                  onChange={(e) => setMaxDelegationDepth(Number(e.target.value))}
                  className="w-full h-10 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 text-xs text-white transition-colors focus:border-zinc-600 focus:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-600 cursor-pointer"
                >
                  <option value={1}>1 Tier (Root Agent only, no sub-delegation)</option>
                  <option value={2}>2 Tiers (Root Orchestrator → Specialist Subagents)</option>
                  <option value={3}>
                    3 Tiers (Extended Tree: Root → Specialists → Micro-Agents)
                  </option>
                </select>
                <span className="text-[11px] text-zinc-500 mt-1 block">
                  Enforces monotonically decreasing spending bounds down the agent delegation
                  hierarchy.
                </span>
              </div>
            </div>
          )}

          {/* Step 4: Dynamic Consent Generation */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileCheck className="h-4 w-4 text-zinc-300" />
                  <span className="text-xs font-semibold text-white">
                    Mandate-Derived Cryptographic Consent
                  </span>
                </div>
                <span className="font-mono text-[10px] rounded border border-zinc-800 bg-zinc-900/80 px-2 py-0.5 text-zinc-400">
                  SHA-256 Digest Bound
                </span>
              </div>

              {/* Monospace Contract Terminal Box */}
              <div className="rounded-xl border border-zinc-800 bg-black p-4 font-mono text-xs text-zinc-300 leading-relaxed shadow-inner">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-900 text-[10px] text-zinc-500">
                  <span>CONSENT_SPEC_V1.AUTH</span>
                  <span>FIDO2 WebAuthn Armed</span>
                </div>
                {dynamicConsentText}
              </div>

              <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-3 text-[11px] text-zinc-400 leading-relaxed">
                <strong className="text-zinc-200">Notice:</strong> This statement is mathematically
                compiled from the configured parameters. It cannot be edited manually. Your
                authorization binds this root mandate policy to the double-entry ledger.
              </div>

              <label className="flex items-start gap-3 p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 cursor-pointer transition-colors select-none">
                <input
                  type="checkbox"
                  checked={consentConfirmed}
                  onChange={(e) => setConsentConfirmed(e.target.checked)}
                  className="mt-0.5 size-4 rounded border-zinc-700 bg-zinc-800 text-white accent-white shrink-0 cursor-pointer"
                />
                <div className="space-y-0.5">
                  <span className="text-xs font-medium text-white block">
                    I explicitly authorize this root delegation grant
                  </span>
                  <span className="text-[11px] text-zinc-400 block leading-relaxed">
                    I acknowledge that autonomous child subagents will be bounded by these
                    invariants and high-value payments will demand biometric passkey sign-off.
                  </span>
                </div>
              </label>
            </div>
          )}

          {/* Step 5: Review & Confirm */}
          {step === 5 && (
            <div className="space-y-4">
              <div className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden text-xs">
                <div className="flex items-center justify-between px-4 py-3 bg-zinc-900/60 border-b border-zinc-800">
                  <span className="font-semibold text-white">Root Mandate Policy Contract</span>
                  <span className="font-mono text-[10px] rounded border border-blue-900/60 bg-blue-950/40 px-2 py-0.5 text-blue-400">
                    Ready for Provisioning
                  </span>
                </div>

                <div className="p-4 space-y-3.5">
                  {/* Row 1: Environment & Type */}
                  <div className="grid grid-cols-2 gap-3 pb-3 border-b border-zinc-900">
                    <div>
                      <span className="text-zinc-500 block text-[10px] uppercase font-mono">
                        Environment
                      </span>
                      <span className="font-medium text-white text-sm">{name}</span>
                      <span className="font-mono text-[11px] text-zinc-400 block">/e/{slug}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500 block text-[10px] uppercase font-mono">
                        Type & Rails
                      </span>
                      <span className="font-medium text-white">{envType.toUpperCase()}</span>
                      <span className="text-zinc-400 text-[11px] block">
                        {allowedRails.join(", ")}
                      </span>
                    </div>
                  </div>

                  {/* Row 2: Financial Caps */}
                  <div className="grid grid-cols-3 gap-3 pb-3 border-b border-zinc-900 font-mono">
                    <div>
                      <span className="text-zinc-500 block text-[10px] uppercase">
                        Root Ceiling
                      </span>
                      <span className="font-bold text-white text-sm">
                        {formatMinorUnits(budgetLimitMinor, currency)}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-500 block text-[10px] uppercase">
                        Approval Trigger
                      </span>
                      <span className="font-medium text-zinc-300 text-sm">
                        {formatMinorUnits(approvalThresholdMinor, currency)}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-500 block text-[10px] uppercase">Max Depth</span>
                      <span className="font-medium text-zinc-300 text-sm">
                        {maxDelegationDepth} Tiers
                      </span>
                    </div>
                  </div>

                  {/* Row 3: Meta details */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-400">Mandate Expiry:</span>
                    <span className="font-mono text-zinc-300">{formattedExpiryDisplay}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-400">Consent Verification:</span>
                    <span className="flex items-center gap-1.5 font-medium text-zinc-200">
                      <CheckCircle2 className="h-3.5 w-3.5 text-blue-400" />
                      Cryptographic Signature Armed
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="flex items-center gap-2.5 p-3 rounded-lg border border-red-500/30 bg-red-950/20 text-xs text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* ─── Footer matching Workspace Action Bar ─── */}
        <div className="px-6 py-4 border-t border-zinc-800/80 bg-zinc-950 flex items-center justify-between">
          {step > 1 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStep((step - 1) as WizardStep)}
              disabled={isSubmitting}
              className="h-9 gap-1.5 border-zinc-800 bg-zinc-900/80 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back</span>
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleClose(false)}
              className="h-9 text-xs text-zinc-400 hover:text-white hover:bg-zinc-900"
            >
              Cancel
            </Button>
          )}

          {step < 5 ? (
            <button
              type="button"
              onClick={handleNextStep}
              className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-4 text-xs font-semibold text-black transition-colors hover:bg-zinc-200 cursor-pointer shadow-sm active:scale-[0.99]"
            >
              <span>Continue</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleAuthorizeAndCreate()}
              disabled={isSubmitting}
              className="flex h-9 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-5 text-xs font-semibold text-black transition-colors hover:bg-zinc-200 disabled:opacity-50 cursor-pointer shadow-sm active:scale-[0.99]"
            >
              {isSubmitting ? (
                <>
                  <div className="h-3.5 w-3.5 rounded-full border-2 border-black border-t-transparent animate-spin" />
                  <span>Authorizing Mandate…</span>
                </>
              ) : (
                <>
                  <Shield className="h-3.5 w-3.5" />
                  <span>Authorize & Create Environment</span>
                </>
              )}
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default CreateEnvironmentWizard;
