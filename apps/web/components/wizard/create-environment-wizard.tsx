"use client";

import * as React from "react";
import {
  Shield,
  FileCheck,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  TestTube2,
  Lock,
  AlertCircle,
  Clock,
  Sparkles,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { formatMinorUnits, parseMajorToMinor, getCurrencySymbol } from "../../app/lib/currency";
import { useWorkspaceStore, workspaceStore, type Environment } from "../../app/lib/workspace-store";
import { apiClient } from "../../lib/api/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";

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
  const [purpose, setPurpose] = React.useState("Autonomous flight booking, vendor procurement, and travel logistics");

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
      // 1. Create Environment in Gateway backend (routes through /api/proxy/v1/environments with session)
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

      // Add to workspace store and switch into it (executes atomic reset)
      workspaceStore.addEnvironment(newEnv);
      onCreated?.(newEnv);
      handleClose(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create environment on Gateway";
      setErrorMessage(msg);
      // Notice: Do NOT register dummy ID to workspace store on failure!
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepTitles = [
    { number: 1, title: "Identity" },
    { number: 2, title: "Root Mandate" },
    { number: 3, title: "Guardrails" },
    { number: 4, title: "Dynamic Consent" },
    { number: 5, title: "Confirm" },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl p-6 sm:p-7 bg-card border border-border rounded-xl text-foreground shadow-2xl top-shade">
        <DialogHeader className="pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-success/10 text-success border border-success/30">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold tracking-tight text-foreground">
                Create Environment & Authorize Root Mandate
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Step {step} of 5: {stepTitles[step - 1]?.title}
              </DialogDescription>
            </div>
          </div>

          {/* Stepper Progress Bar */}
          <div className="mt-4 flex items-center justify-between gap-2">
            {stepTitles.map((s) => {
              const isPast = s.number < step;
              const isCurrent = s.number === step;

              return (
                <div key={s.number} className="flex-1 flex flex-col gap-1.5">
                  <div
                    className={cn(
                      "h-1 w-full rounded-full transition-all duration-200",
                      isPast && "bg-success",
                      isCurrent && "bg-success shadow-[0_0_8px_oklch(0.751_0.209_154.1)]",
                      !isPast && !isCurrent && "bg-white/[0.08]"
                    )}
                  />
                  <span
                    className={cn(
                      "text-[10px] font-mono tracking-tight",
                      isCurrent ? "text-success font-medium" : isPast ? "text-muted-foreground" : "text-muted-foreground"
                    )}
                  >
                    {s.number}. {s.title}
                  </span>
                </div>
              );
            })}
          </div>
        </DialogHeader>

        {/* Step 1: Identity */}
        {step === 1 && (
          <div className="py-4 space-y-4">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">
                Environment Name
              </label>
              <Input
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. Travel & Logistics"
                className="h-9 text-xs"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">
                Slug Identifier
              </label>
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="e.g. travel-logistics"
                className="h-9 font-mono text-xs"
              />
              <span className="text-[10px] text-muted-foreground mt-1 block">
                Scoped route prefix: `/e/{slug}`
              </span>
            </div>

            <div>
              <label className="text-xs font-medium text-foreground block mb-2">
                Environment Isolation Type
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div
                  onClick={() => setEnvType("sandbox")}
                  className={cn(
                    "cursor-pointer rounded-lg border p-3 transition-all",
                    envType === "sandbox"
                      ? "border-warning bg-warning/[0.08] top-shade"
                      : "border-border bg-card hover:border-border"
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                      <TestTube2 className="h-3.5 w-3.5 text-warning" />
                      Sandbox
                    </span>
                    <Badge variant="pending" className="text-[9px]">
                      Safe
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Test simulated payment rails and attack scenarios with zero financial risk.
                  </p>
                </div>

                <div
                  onClick={() => setEnvType("production")}
                  className={cn(
                    "cursor-pointer rounded-lg border p-3 transition-all",
                    envType === "production"
                      ? "border-success bg-success/10 top-shade"
                      : "border-border bg-card hover:border-border"
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5 text-success" />
                      Production
                    </span>
                    <Badge variant="authorized" className="text-[9px]">
                      Live
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Live financial execution via PayPal credentials with real cardholder settlement.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">
                Purpose & Scope
              </label>
              <Input
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="Describe intended operations for this environment"
                className="h-9 text-xs"
              />
            </div>
          </div>
        )}

        {/* Step 2: Root Mandate */}
        {step === 2 && (
          <div className="py-4 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-foreground block mb-1.5">
                  Currency
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-border bg-card px-3 py-1 text-xs text-foreground focus-visible:outline-none"
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="JPY">JPY (¥)</option>
                  <option value="INR">INR (₹)</option>
                </select>
              </div>

              <div className="col-span-2">
                <label className="text-xs font-medium text-foreground block mb-1.5">
                  Root Budget Limit
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-muted-foreground">
                    {getCurrencySymbol(currency)}
                  </span>
                  <Input
                    value={budgetString}
                    onChange={(e) => setBudgetString(e.target.value)}
                    placeholder="10,000"
                    className="pl-8 font-mono text-xs h-9 tabular-nums"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-md border border-border bg-card p-2.5 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Deterministic Minor Unit Integer:</span>
              <span className="font-mono font-medium text-success tabular-nums">
                {budgetLimitMinor.toLocaleString()} {currency === "JPY" ? "yen" : "cents/minor"}
              </span>
            </div>

            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">
                Mandate Validity & Expiry
              </label>
              <div className="grid grid-cols-4 gap-2 mb-2">
                {(["7d", "30d", "90d", "custom"] as const).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setExpiryPreset(preset)}
                    className={cn(
                      "rounded-md border py-1.5 text-xs font-medium transition-all",
                      expiryPreset === preset
                        ? "border-success bg-success/10 text-success"
                        : "border-border bg-card text-muted-foreground hover:bg-white/[0.04]"
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
                <Input
                  type="date"
                  value={customExpiry}
                  onChange={(e) => setCustomExpiry(e.target.value)}
                  className="h-9 text-xs font-mono"
                />
              ) : (
                <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono mt-1">
                  <Clock className="h-3.5 w-3.5 text-success" />
                  <span>Authority expires on: {formattedExpiryDisplay}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Guardrails */}
        {step === 3 && (
          <div className="py-4 space-y-4">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">
                Authorized Payment Rails
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
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
                    className="rounded border-border bg-card accent-success"
                  />
                  <span>PayPal (Orders & Authorizations API v2)</span>
                </label>

                {envType === "sandbox" && (
                  <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
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
                      className="rounded border-border bg-card accent-warning"
                    />
                    <span>Simulation Mock Rail (In-memory attack vector testing)</span>
                  </label>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-foreground block mb-1.5">
                  Max Per-Action Cap
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-muted-foreground">
                    {getCurrencySymbol(currency)}
                  </span>
                  <Input
                    value={maxPerActionString}
                    onChange={(e) => setMaxPerActionString(e.target.value)}
                    placeholder="500"
                    className="pl-8 font-mono text-xs h-9 tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1.5">
                  Human Approval Threshold
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-muted-foreground">
                    {getCurrencySymbol(currency)}
                  </span>
                  <Input
                    value={approvalThresholdString}
                    onChange={(e) => setApprovalThresholdString(e.target.value)}
                    placeholder="1,000"
                    className="pl-8 font-mono text-xs h-9 tabular-nums"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">
                Maximum Delegation Depth
              </label>
              <select
                value={maxDelegationDepth}
                onChange={(e) => setMaxDelegationDepth(Number(e.target.value))}
                className="flex h-9 w-full rounded-md border border-border bg-card px-3 py-1 text-xs text-foreground focus-visible:outline-none"
              >
                <option value={1}>1 Level (Root Agent only, no sub-delegation)</option>
                <option value={2}>2 Levels (Root Agent → Specialist Subagents)</option>
                <option value={3}>3 Levels (Root Agent → Specialists → Micro-Agents)</option>
                <option value={4}>4 Levels (Extended tree)</option>
              </select>
              <span className="text-[10px] text-muted-foreground mt-1 block">
                Limits how many hops of authority child agents may spawn.
              </span>
            </div>
          </div>
        )}

        {/* Step 4: Dynamic Consent Generation */}
        {step === 4 && (
          <div className="py-4 space-y-4">
            <div className="flex items-center gap-2">
              <FileCheck className="h-4 w-4 text-success" />
              <span className="text-xs font-semibold text-foreground">
                Mandate-Derived Cryptographic Consent Agreement
              </span>
            </div>

            <div className="rounded-lg border border-border bg-card p-4 font-mono text-xs text-foreground leading-relaxed shadow-inner">
              {dynamicConsentText}
            </div>

            <div className="rounded-md border border-border bg-white/[0.02] p-3 text-[11px] text-muted-foreground leading-relaxed">
              <strong>Notice:</strong> This consent statement is computed deterministically from your mandate policies. It cannot be edited manually. Your digital signature authorizes the gateway to bind this root policy to the ledger.
            </div>

            <label className="flex items-start gap-2.5 p-2 rounded-md border border-border bg-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={consentConfirmed}
                onChange={(e) => setConsentConfirmed(e.target.checked)}
                className="mt-0.5 rounded border-border bg-card accent-success shrink-0"
              />
              <span className="text-xs font-medium text-foreground">
                I have reviewed the synthesized mandate terms above and explicitly authorize this root delegation grant.
              </span>
            </label>
          </div>
        )}

        {/* Step 5: Review & Confirm */}
        {step === 5 && (
          <div className="py-4 space-y-4">
            <div className="rounded-lg border border-border bg-card overflow-hidden text-xs">
              <div className="p-3 bg-white/[0.04] border-b border-border font-semibold text-foreground">
                Root Mandate Policy Summary
              </div>
              <div className="divide-y divide-border">
                <div className="flex justify-between p-2.5">
                  <span className="text-muted-foreground">Environment:</span>
                  <span className="font-medium text-foreground">
                    {name} <span className="font-mono text-muted-foreground">({slug})</span>
                  </span>
                </div>
                <div className="flex justify-between p-2.5">
                  <span className="text-muted-foreground">Type:</span>
                  <Badge variant={envType === "sandbox" ? "pending" : "authorized"}>
                    {envType.toUpperCase()}
                  </Badge>
                </div>
                <div className="flex justify-between p-2.5">
                  <span className="text-muted-foreground">Root Budget Limit:</span>
                  <span className="font-mono font-semibold text-success tabular-nums">
                    {formatMinorUnits(budgetLimitMinor, currency)} ({budgetLimitMinor} minor)
                  </span>
                </div>
                <div className="flex justify-between p-2.5">
                  <span className="text-muted-foreground">Auto-Approval Cap:</span>
                  <span className="font-mono text-foreground tabular-nums">
                    {formatMinorUnits(approvalThresholdMinor, currency)}
                  </span>
                </div>
                <div className="flex justify-between p-2.5">
                  <span className="text-muted-foreground">Max Delegation Depth:</span>
                  <span className="font-medium text-foreground">{maxDelegationDepth} Levels</span>
                </div>
                <div className="flex justify-between p-2.5">
                  <span className="text-muted-foreground">Expires At:</span>
                  <span className="font-mono text-foreground">{formattedExpiryDisplay}</span>
                </div>
                <div className="flex justify-between p-2.5">
                  <span className="text-muted-foreground">Consent Status:</span>
                  <span className="flex items-center gap-1 font-semibold text-success">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Authorized by Operator
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="flex items-center gap-2 p-2.5 rounded-md border border-destructive/30 bg-destructive/10 text-xs text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Footer Navigation Buttons */}
        <div className="flex items-center justify-between pt-4 border-t border-border mt-2">
          {step > 1 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStep((step - 1) as WizardStep)}
              disabled={isSubmitting}
              className="gap-1.5 text-xs"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back</span>
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleClose(false)}
              className="text-xs text-muted-foreground"
            >
              Cancel
            </Button>
          )}

          {step < 5 ? (
            <Button
              variant="primary"
              size="sm"
              onClick={handleNextStep}
              className="gap-1.5 text-xs"
            >
              <span>Continue</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={() => void handleAuthorizeAndCreate()}
              disabled={isSubmitting}
              className="gap-2 text-xs bg-success hover:bg-success/90 text-background font-semibold"
            >
              <Shield className="h-4 w-4" />
              <span>{isSubmitting ? "Authorizing Mandate…" : "Authorize & Create Environment"}</span>
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
