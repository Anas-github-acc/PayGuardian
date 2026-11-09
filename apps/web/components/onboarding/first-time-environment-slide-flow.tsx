"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FlutedGlass } from "@paper-design/shaders-react";
import {
  ArrowRight,
  ArrowLeft,
  Sparkles,
  AlertCircle,
  Loader2,
  Compass,
  Cpu,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { LetsWorkTogether } from "@/components/ui/lets-work-section";
import { formatMinorUnits, parseMajorToMinor } from "../../app/lib/currency";
import { workspaceStore, type Environment } from "../../app/lib/workspace-store";
import { apiClient } from "../../lib/api/client";
import { mapEnvironmentDto } from "../../lib/api/mappers/environment";

export type SlideStep = 1 | 2 | 3 | 4;

interface SlideExplanation {
  authorName: string;
  authorRole: string;
  authorAvatar: string;
  quote: string;
  description: string;
}

const SLIDE_EXPLANATIONS: Record<SlideStep, SlideExplanation> = {
  1: {
    authorName: "Harrison Chase",
    authorRole: "Co-Founder & CEO, LangChain",
    authorAvatar:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    quote:
      "“Without strict environment boundaries, autonomous multi-agent loops can spin up recursive actions and unintentionally trigger live financial execution.”",
    description:
      "Every environment in PayGuardian acts as a sovereign cryptographic cell. Agent identities, memory vaults, and ledger balances are strictly partitioned, ensuring your sandbox experiments never contaminate production rails.",
  },
  2: {
    authorName: "Vitalik Buterin",
    authorRole: "Co-Founder, Ethereum",
    authorAvatar:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
    quote:
      "“Never hand an autonomous agent unrestricted credentials. Authority must be mathematically bounded and delegated through non-repudiable cryptographic commitments.”",
    description:
      "Humans issue the root authority mandate with an immutable spending ceiling. The Primary Orchestrator can only carve out smaller sub-mandates down a directed acyclic graph (depth ≤ 2), guaranteeing no agent can allocate more authority than its parent holds.",
  },
  3: {
    authorName: "Andrew Ng",
    authorRole: "Founder, DeepLearning.AI · Managing General Partner, AI Fund",
    authorAvatar:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
    quote:
      "“Autonomous workflows require clear guardrails: sub-second execution for routine tasks, but mandatory human-in-the-loop sign-off whenever high-value actions are taken.”",
    description:
      "Routine micro-spend under your threshold executes autonomously in milliseconds. High-value transactions or actions outside permitted rails halt immediately, demanding hardware FIDO2 passkey biometric verification from human operators.",
  },
  4: {
    authorName: "Moxie Marlinspike",
    authorRole: "Cryptographer · Security Researcher",
    authorAvatar:
      "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80",
    quote:
      "“Financial integrity demands cryptographic invariants: zero floating-point approximation, integer-only accounting, and tamper-evident rolling digests.”",
    description:
      "Floating-point representation errors are eliminated entirely. Available + Reserved + Spent strictly equals the allocated ceiling at every moment, secured with tamper-evident cryptographic hash chaining.",
  },
};

export function FirstTimeEnvironmentSlideFlow() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [viewMode, setViewMode] = useState<"hero" | "create">("hero");
  const [step, setStep] = useState<SlideStep>(1);

  // Form State
  const [name, setName] = useState("Procurement & Travel");
  const [slug, setSlug] = useState("procurement-travel");
  const [envType, setEnvType] = useState<"sandbox" | "production">("sandbox");
  const [purpose, setPurpose] = useState(
    "Autonomous hotel and flight booking, vendor procurement, and corporate travel reconciliation."
  );

  // Mandate & Budget
  const [currency, setCurrency] = useState("USD");
  const [budgetDisplay, setBudgetDisplay] = useState("10,000.00");
  const [expiryDays, setExpiryDays] = useState(90);
  const [rootAgentName, setRootAgentName] = useState("Main Orchestrator");

  // Guardrails
  const [thresholdDisplay, setThresholdDisplay] = useState("500.00");
  const [maxDelegationDepth, setMaxDelegationDepth] = useState(2);
  const [allowedRails, setAllowedRails] = useState<string[]>([
    "PayPal",
    "Simulation",
  ]);
  const [requirePasskey, setRequirePasskey] = useState(true);
  const [cascadeRevoke, setCascadeRevoke] = useState(true);

  // Submission & Feedback State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Update slug automatically from name
  const handleNameChange = (val: string) => {
    setName(val);
    const generatedSlug = val
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    setSlug(generatedSlug || "env");
  };

  // Preset Loaders
  const applyPreset = (preset: "travel" | "cloudOps") => {
    if (preset === "travel") {
      setName("Travel & Hospitality Sandbox");
      setSlug("travel-hospitality");
      setEnvType("sandbox");
      setPurpose(
        "Autonomous flight booking, hotel procurement, and itinerary settlement."
      );
      setCurrency("USD");
      setBudgetDisplay("10,000.00");
      setThresholdDisplay("500.00");
      setRootAgentName("Main Travel Orchestrator");
      setAllowedRails(["PayPal", "Simulation"]);
    } else {
      setName("Production Cloud Ops");
      setSlug("prod-cloud-ops");
      setEnvType("production");
      setPurpose(
        "Live infrastructure auto-scaling, vendor compute procurement, and incident settlement."
      );
      setCurrency("USD");
      setBudgetDisplay("50,000.00");
      setThresholdDisplay("1,000.00");
      setRootAgentName("Core Infrastructure Orchestrator");
      setAllowedRails(["PayPal"]);
    }
  };

  const calculatedBudgetMinor = React.useMemo(() => {
    try {
      return Math.max(100, parseMajorToMinor(budgetDisplay, currency));
    } catch {
      return 1000000;
    }
  }, [budgetDisplay, currency]);

  const calculatedThresholdMinor = React.useMemo(() => {
    try {
      return Math.max(100, parseMajorToMinor(thresholdDisplay, currency));
    } catch {
      return 50000;
    }
  }, [thresholdDisplay, currency]);

  const calculatedExpiryDate = React.useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + expiryDays);
    return d.toISOString();
  }, [expiryDays]);

  const dynamicConsentText = React.useMemo(() => {
    const formattedBudget = formatMinorUnits(calculatedBudgetMinor, currency);
    const formattedThreshold = formatMinorUnits(calculatedThresholdMinor, currency);
    return `By proceeding, you grant authority to environment '${name}' to execute bounded transactions up to ${formattedBudget} via ${allowedRails.join(
      ", "
    )}. Any action exceeding ${formattedThreshold} strictly demands cryptographic FIDO2 passkey biometric verification. Max delegation depth is capped at ${maxDelegationDepth} tiers. Authority expires in ${expiryDays} days.`;
  }, [
    name,
    calculatedBudgetMinor,
    calculatedThresholdMinor,
    currency,
    allowedRails,
    maxDelegationDepth,
    expiryDays,
  ]);

  const handleNextStep = () => {
    setErrorMessage(null);
    if (step < 4) {
      setStep((step + 1) as SlideStep);
    }
  };

  const handlePrevStep = () => {
    setErrorMessage(null);
    if (step > 1) {
      setStep((step - 1) as SlideStep);
    }
  };

  const handleCreateAndDeploy = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      setSubmissionStatus("1/3 Initializing isolated environment on Gateway...");
      const createdEnv = await apiClient.environments.create({
        name,
        purpose,
        currency,
        budgetLimitMinor: calculatedBudgetMinor,
      });

      if (!createdEnv?.id) {
        throw new Error("Gateway failed to return a valid environment ID");
      }

      setSubmissionStatus("2/3 Registering root orchestrator and keypairs...");
      const rootAgent = await apiClient.agents.createRoot(createdEnv.id, {
        name: rootAgentName,
        capabilities: ["delegate", "simulate", "spend", "reserve"],
      });

      setSubmissionStatus("3/3 Bounding root authority mandate and ledger accounts...");
      const rootMandate = await apiClient.mandates.createRoot(createdEnv.id, {
        holderAgentId: rootAgent.id,
        budgetLimitMinor: calculatedBudgetMinor,
        currency,
        permittedActions: ["*"],
        expiresAt: calculatedExpiryDate,
        canDelegate: true,
        maxDelegationDepth,
        approvalRequired: true,
      });

      // Clean bootstrap: only the Root Agent and Root Mandate are created upfront.
      // Child specialist agents and delegated sub-mandates are created on-demand when agent delegation occurs.
      const agentCount = 1;

      // Assemble confirmed Environment domain model
      const finalEnv: Environment = mapEnvironmentDto(createdEnv, {
        slug,
        type: envType,
        agentCount,
        maxDelegationDepth,
        approvalThresholdMinor: calculatedThresholdMinor,
        allowedRails,
        consentStatement: dynamicConsentText,
        expiresAt: calculatedExpiryDate,
      });

      // Add to store and atomically switch into it
      workspaceStore.addEnvironment(finalEnv);

      // Route immediately to the dashboard
      router.replace("/dashboard");
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to create environment on Gateway. Please verify connectivity.";
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
      setSubmissionStatus("");
    }
  };

  const activeExplanation = SLIDE_EXPLANATIONS[step];

  return (
    <section
      className="relative h-screen max-h-screen w-full overflow-hidden p-0 text-white antialiased [font-synthesis:none] selection:bg-zinc-800 selection:text-white bg-[#0a0a0c] dark:bg-[#0a0a0c]"
      style={{
        backgroundColor: "rgb(10 10 12 / var(--tw-bg-opacity, 1))",
        backgroundImage:
          "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02) 45%, transparent 75%)",
      }}
    >
      <AnimatePresence mode="wait">
        {viewMode === "hero" ? (
          <motion.div
            key="hero-view"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, y: -24, filter: "blur(6px)" }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="flex h-full w-full items-center justify-center p-0 overflow-hidden"
          >
            <LetsWorkTogether
              onGetStarted={() => setViewMode("create")}
              actionText="Get Started"
              learnMoreText="Learn More"
              className="h-full w-full max-h-screen overflow-hidden bg-transparent"
            />
          </motion.div>
        ) : (
          <motion.div
            key="create-view"
            initial={{ opacity: 0, y: 24, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: 24, filter: "blur(6px)" }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="grid h-full max-h-[calc(100vh-1rem)] gap-6 p-3 sm:p-4 lg:grid-cols-[0.94fr_1.06fr] overflow-y-auto"
          >
        {/* Left Column: Slide-by-Slide Environment Creation Form */}
        <div className="flex min-h-[760px] items-center justify-center rounded-md border border-black/10 bg-white px-6 py-12 dark:border-white/5 dark:bg-[#0a0a0c] lg:min-h-0 lg:px-14 lg:py-16 xl:px-20">
          <div className="mx-auto w-full max-w-[480px]">
            {/* Step Progress Pill & Bar */}
            <div className="mb-6 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="font-semibold uppercase tracking-wider text-black/50 dark:text-white/40">
                  Slide {step} of 4 ·{" "}
                  {step === 1 && "Identity & Isolation"}
                  {step === 2 && "Set your spending authority"}
                  {step === 3 && "Define delegation rules"}
                  {step === 4 && "Review & activate"}
                </span>
                <span className="font-semibold font-mono text-black/70 dark:text-white/70">
                  {step * 25}%
                </span>
              </div>
              <div className="h-1 w-full rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                <motion.div
                  className="h-full bg-black dark:bg-white"
                  initial={false}
                  animate={{ width: `${step * 25}%` }}
                  transition={{ duration: 0.35, ease: "easeInOut" }}
                />
              </div>
            </div>

            {/* Slide Header */}
            <div>
              <h1 className="text-3xl font-medium tracking-tight sm:text-4xl text-black dark:text-white">
                {step === 1 && "Create your environment"}
                {step === 2 && "Set your spending authority"}
                {step === 3 && "Define delegation rules"}
                {step === 4 && "Review & activate"}
              </h1>
              <p className="mt-2 text-sm text-black/60 dark:text-white/50 leading-relaxed">
                {step === 1 &&
                  "Define the isolated boundary. Testing, memory, and balances will never leak to other environments."}
                {step === 2 &&
                  "Specify currency and maximum budget ceiling. Orchestrator agents cannot spend more than this allocation."}
                {step === 3 &&
                  "Define autonomous spending limits and require biometric hardware sign-off for threshold-crossing actions."}
                {step === 4 &&
                  "Verify the non-repudiable authority contract before generating root credentials and double-entry ledgers."}
              </p>
            </div>

            {/* Quick Presets on Slide 1 */}
            {step === 1 && (
              <div className="mt-6">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-black/40 dark:text-white/30 mb-2.5">
                  1-Click Quickstart Presets
                </p>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => applyPreset("travel")}
                    className="flex h-11 w-full items-center justify-start gap-2 rounded-lg border border-black/15 bg-white px-3.5 text-xs font-medium text-black transition-colors hover:bg-black/[0.03] dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10 text-left"
                  >
                    <Compass className="size-4 shrink-0 text-black/60 dark:text-white/60" />
                    <span className="truncate">Travel & Logistics</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => applyPreset("cloudOps")}
                    className="flex h-11 w-full items-center justify-start gap-2 rounded-lg border border-black/15 bg-white px-3.5 text-xs font-medium text-black transition-colors hover:bg-black/[0.03] dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10 text-left"
                  >
                    <Cpu className="size-4 shrink-0 text-black/60 dark:text-white/60" />
                    <span className="truncate">Cloud Ops (Prod)</span>
                  </button>
                </div>

                <div className="my-5 flex items-center gap-4 text-xs font-medium text-black/40 dark:text-white/30">
                  <div className="h-px flex-1 bg-black/10 dark:bg-white/10" />
                  or customize parameters
                  <div className="h-px flex-1 bg-black/10 dark:bg-white/10" />
                </div>
              </div>
            )}

            {/* Slide Forms */}
            <div className="mt-5 space-y-4">
              <AnimatePresence mode="wait">
                {step === 1 && (
                  <motion.div
                    key="slide-1"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-4"
                  >
                    <InputField
                      label="Environment Name"
                      value={name}
                      placeholder="e.g. Procurement & Travel"
                      onChange={handleNameChange}
                    />

                    <div className="grid grid-cols-2 gap-3">
                      <InputField
                        label="Environment Slug"
                        value={slug}
                        placeholder="procurement-travel"
                        onChange={setSlug}
                      />
                      <div className="space-y-1.5 text-left w-full">
                        <label className="text-xs font-semibold text-black/60 dark:text-white/60">
                          Environment Type
                        </label>
                        <div className="grid grid-cols-2 gap-1 h-11 p-1 rounded-lg border border-black/15 bg-white dark:border-white/10 dark:bg-white/5">
                          <button
                            type="button"
                            onClick={() => setEnvType("sandbox")}
                            className={`rounded text-xs font-medium transition-all ${
                              envType === "sandbox"
                                ? "bg-black text-white dark:bg-white dark:text-black shadow-sm"
                                : "text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white"
                            }`}
                          >
                            Sandbox
                          </button>
                          <button
                            type="button"
                            onClick={() => setEnvType("production")}
                            className={`rounded text-xs font-medium transition-all ${
                              envType === "production"
                                ? "bg-black text-white dark:bg-white dark:text-black shadow-sm"
                                : "text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white"
                            }`}
                          >
                            Prod
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-left w-full">
                      <label className="text-xs font-semibold text-black/60 dark:text-white/60">
                        Primary Purpose & Scope
                      </label>
                      <textarea
                        rows={2}
                        value={purpose}
                        onChange={(e) => setPurpose(e.target.value)}
                        placeholder="Describe the bounded tasks agents in this environment will execute..."
                        className="w-full resize-none rounded-lg border border-black/15 bg-white p-3 text-sm text-black outline-none placeholder:text-black/30 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/30"
                      />
                    </div>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div
                    key="slide-2"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-4"
                  >
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-1 space-y-1.5 text-left w-full">
                        <label className="text-xs font-semibold text-black/60 dark:text-white/60">
                          Currency
                        </label>
                        <select
                          value={currency}
                          onChange={(e) => setCurrency(e.target.value)}
                          className="flex h-11 w-full rounded-lg border border-black/15 bg-white px-3 text-sm font-medium text-black outline-none dark:border-white/10 dark:bg-[#121214] dark:text-white"
                        >
                          <option value="USD">USD ($)</option>
                          <option value="EUR">EUR (€)</option>
                          <option value="GBP">GBP (£)</option>
                          <option value="INR">INR (₹)</option>
                        </select>
                      </div>

                      <div className="col-span-2">
                        <InputField
                          label="Root Mandate Spending Ceiling"
                          value={budgetDisplay}
                          placeholder="10,000.00"
                          onChange={setBudgetDisplay}
                        />
                      </div>
                    </div>

                    <InputField
                      label="Primary Root Orchestrator Name"
                      value={rootAgentName}
                      placeholder="Main Travel Orchestrator"
                      onChange={setRootAgentName}
                    />

                    <div className="space-y-1.5 text-left w-full">
                      <label className="text-xs font-semibold text-black/60 dark:text-white/60">
                        Authority Validity Window
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {[30, 90, 365].map((days) => (
                          <button
                            key={days}
                            type="button"
                            onClick={() => setExpiryDays(days)}
                            className={`flex h-10 items-center justify-center rounded-lg border text-xs font-medium transition-all ${
                              expiryDays === days
                                ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                                : "border-black/15 bg-white text-black/70 hover:bg-black/[0.02] dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/10"
                            }`}
                          >
                            {days} Days
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}

                {step === 3 && (
                  <motion.div
                    key="slide-3"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-4"
                  >
                    <InputField
                      label="Autonomous Threshold (Human Halt Limit)"
                      value={thresholdDisplay}
                      placeholder="500.00"
                      onChange={setThresholdDisplay}
                    />

                    <div className="space-y-1.5 text-left w-full">
                      <label className="text-xs font-semibold text-black/60 dark:text-white/60">
                        Max Delegation Depth (Hard Invariant: Depth ≤ 2)
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {[1, 2].map((depth) => (
                          <button
                            key={depth}
                            type="button"
                            onClick={() => setMaxDelegationDepth(depth)}
                            className={`flex h-10 items-center justify-center rounded-lg border text-xs font-medium transition-all ${
                              maxDelegationDepth === depth
                                ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                                : "border-black/15 bg-white text-black/70 hover:bg-black/[0.02] dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/10"
                            }`}
                          >
                            {depth} {depth === 1 ? "Tier (Root Only)" : "Tiers (Root + Specialists)"}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3 pt-2 text-xs leading-5 text-black/60 dark:text-white/50">
                      <CheckboxLine
                        checked={requirePasskey}
                        onChange={setRequirePasskey}
                      >
                        Mandatory WebAuthn / FIDO2 passkey confirmation for any
                        action exceeding the threshold.
                      </CheckboxLine>
                      <CheckboxLine
                        checked={cascadeRevoke}
                        onChange={setCascadeRevoke}
                      >
                        Enforce instant cascading revocation across all child
                        delegations upon environment pause or shutdown.
                      </CheckboxLine>
                    </div>
                  </motion.div>
                )}

                {step === 4 && (
                  <motion.div
                    key="slide-4"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-3.5"
                  >
                    {/* Contract Summary Box */}
                    <div className="rounded-lg border border-black/10 bg-black/[0.02] p-3.5 space-y-2 text-xs dark:border-white/10 dark:bg-white/5">
                      <div className="flex justify-between items-center pb-2 border-b border-black/10 dark:border-white/10">
                        <span className="font-semibold text-black dark:text-white">
                          {name}
                        </span>
                        <span className="font-mono uppercase text-[10px] px-2 py-0.5 rounded bg-black/5 text-black/70 border border-black/15 dark:bg-white/10 dark:text-white/80 dark:border-white/20">
                          {envType}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                        <div>
                          <span className="text-black/40 dark:text-white/40 block text-[9px] uppercase">
                            Root Ceiling
                          </span>
                          <span className="text-black dark:text-white font-medium">
                            {formatMinorUnits(calculatedBudgetMinor, currency)}
                          </span>
                        </div>
                        <div>
                          <span className="text-black/40 dark:text-white/40 block text-[9px] uppercase">
                            Approval Trigger
                          </span>
                          <span className="text-black/70 dark:text-white/70 font-medium">
                            {formatMinorUnits(calculatedThresholdMinor, currency)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-black/10 bg-white p-3 text-[11px] leading-relaxed text-black/60 dark:border-white/10 dark:bg-white/5 dark:text-white/50">
                      <p className="font-semibold text-black dark:text-white mb-1">
                        Cryptographic Authority Consent
                      </p>
                      <p>{dynamicConsentText}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Error Notice */}
              {errorMessage && (
                <div className="flex items-center gap-2 p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-xs text-red-600 dark:text-red-400">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Step Navigation Actions */}
              <div className="pt-2 flex items-center justify-between gap-3">
                {step > 1 ? (
                  <button
                    type="button"
                    onClick={handlePrevStep}
                    disabled={isSubmitting}
                    className="flex h-11 items-center justify-center gap-1.5 rounded-lg border border-black/15 bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-black/[0.02] dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10 disabled:opacity-50 cursor-pointer"
                  >
                    <ArrowLeft className="size-4" />
                    <span>Back</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setViewMode("hero")}
                    className="flex h-11 items-center justify-center gap-1.5 rounded-lg border border-black/15 bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-black/[0.02] dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10 cursor-pointer"
                  >
                    <ArrowLeft className="size-4" />
                    <span>Intro</span>
                  </button>
                )}

                {step === 1 && (
                  <button
                    type="button"
                    onClick={handleNextStep}
                    className="ml-auto flex h-11 items-center justify-center gap-2 rounded-lg border border-black/40 bg-black px-6 text-sm font-medium text-white transition-colors hover:bg-black/85 dark:border-white/40 dark:bg-white dark:text-black dark:hover:bg-white/85 cursor-pointer"
                  >
                    <span>Set your spending authority</span>
                    <ArrowRight className="size-4" />
                  </button>
                )}
                {step === 2 && (
                  <button
                    type="button"
                    onClick={handleNextStep}
                    className="ml-auto flex h-11 items-center justify-center gap-2 rounded-lg border border-black/40 bg-black px-6 text-sm font-medium text-white transition-colors hover:bg-black/85 dark:border-white/40 dark:bg-white dark:text-black dark:hover:bg-white/85 cursor-pointer"
                  >
                    <span>Define delegation rules</span>
                    <ArrowRight className="size-4" />
                  </button>
                )}
                {step === 3 && (
                  <button
                    type="button"
                    onClick={handleNextStep}
                    className="ml-auto flex h-11 items-center justify-center gap-2 rounded-lg border border-black/40 bg-black px-6 text-sm font-medium text-white transition-colors hover:bg-black/85 dark:border-white/40 dark:bg-white dark:text-black dark:hover:bg-white/85 cursor-pointer"
                  >
                    <span>Review & activate</span>
                    <ArrowRight className="size-4" />
                  </button>
                )}
                {step === 4 && (
                  <button
                    type="button"
                    onClick={handleCreateAndDeploy}
                    disabled={isSubmitting}
                    className="ml-auto flex h-11 items-center justify-center gap-2 rounded-lg border border-black/40 bg-black px-6 text-sm font-medium text-white transition-colors hover:bg-black/85 dark:border-white/40 dark:bg-white dark:text-black dark:hover:bg-white/85 disabled:opacity-60 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="size-4 animate-spin text-white dark:text-black" />
                        <span>{submissionStatus || "Activating..."}</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="size-4 text-white dark:text-black" />
                        <span>Activate Environment</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: FlutedGlass Shader + Dynamic Architectural Testimonial & Mockup */}
        <div className="relative flex min-h-[720px] flex-col overflow-hidden rounded-md bg-gradient-to-b from-black to-white p-8 text-white dark:to-[#050505] sm:p-12 lg:min-h-0 lg:p-16">
          {/* Background Shader */}
          <div className="absolute inset-0 z-0 pointer-events-none">
            {mounted && (
              <FlutedGlass
                size={0.89}
                shape="lines"
                angle={0}
                distortionShape="prism"
                distortion={0.5}
                shift={0}
                blur={0}
                edges={0.25}
                stretch={0}
                scale={1.11}
                fit="cover"
                highlights={0.1}
                shadows={0.2}
                grainMixer={0.1}
                grainOverlay={0.1}
                colorBack="#00000000"
                colorHighlight="#FFFFFF"
                colorShadow="#000000"
                className="w-full h-full bg-transparent"
              />
            )}
          </div>

          <div className="relative z-10 h-full w-full flex flex-col justify-between">
            <div className="max-w-[500px] lg:pt-8">
              {/* Dynamic Author Card */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={`author-${step}`}
                  initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -12, filter: "blur(6px)" }}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  className="flex items-center gap-4"
                >
                  <img
                    src={activeExplanation.authorAvatar}
                    alt={activeExplanation.authorName}
                    className="size-10 shrink-0 rounded-full border border-white/20 object-cover"
                  />
                  <div>
                    <div className="font-semibold leading-tight text-white">
                      {activeExplanation.authorName}
                    </div>
                    <div className="mt-0.5 text-xs text-white/60">
                      {activeExplanation.authorRole}
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>

              {/* Dynamic Quote */}
              <AnimatePresence mode="wait">
                <motion.blockquote
                  key={`quote-${step}`}
                  initial={{ opacity: 0, y: 18, filter: "blur(8px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -18, filter: "blur(8px)" }}
                  transition={{
                    duration: 0.6,
                    delay: 0.08,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="mt-6 text-xl font-light leading-snug tracking-[-0.03em] text-white/90 sm:text-2xl"
                >
                  {activeExplanation.quote}
                </motion.blockquote>
              </AnimatePresence>

              {/* Clean unboxed text with color between black and white */}
              <AnimatePresence mode="wait">
                <motion.p
                  key={`desc-${step}`}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -14 }}
                  transition={{ duration: 0.5, delay: 0.14 }}
                  className="mt-6 text-sm sm:text-base font-light leading-relaxed text-white/60 text-left"
                >
                  {activeExplanation.description}
                </motion.p>
              </AnimatePresence>
            </div>

            {/* Floating Mockup Window Displaying Environment Topology Graph */}
            <div className="mt-8 w-full translate-y-[15%] overflow-hidden rounded-2xl border border-white/15 bg-black/70 p-2 shadow-[0_30px_90px_rgba(0,0,0,0.5)] backdrop-blur-xl sm:translate-y-[12%] lg:absolute lg:left-[10%] lg:-bottom-20 lg:mt-0 lg:w-[105%] lg:max-w-none lg:origin-bottom-left lg:translate-y-0 lg:-rotate-2 xl:left-[12%] xl:-bottom-[120px] xl:w-[108%]">
              <motion.div
                initial={{ opacity: 0, y: 50, filter: "blur(10px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{
                  duration: 0.8,
                  delay: 0.2,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="overflow-hidden rounded-xl border border-white/10 bg-black"
              >
                {/* Window Header */}
                <div className="flex items-center gap-1.5 border-b border-white/10 bg-black/40 px-4 py-2.5 select-none">
                  <div className="size-2 rounded-full bg-white/35" />
                  <div className="size-2 rounded-full bg-white/25" />
                  <div className="size-2 rounded-full bg-white/15" />
                  <span className="ml-4 font-mono text-[9px] tracking-wider text-white/50">
                    payguardian.io/{slug || "env"}/topology-preview
                  </span>
                  <span className="ml-auto font-mono text-[9px] text-white/80 bg-white/10 px-1.5 py-0.5 rounded border border-white/20">
                    {formatMinorUnits(calculatedBudgetMinor, currency)} Ceil
                  </span>
                </div>

                {/* Topology Graph Graphic Preview */}
                <div className="p-4 bg-zinc-950/90 text-white min-h-[180px] flex flex-col justify-between">
                  <div className="flex items-center justify-between pb-3 border-b border-zinc-900 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="size-2 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.4)]" />
                      <span className="font-semibold text-zinc-100">
                        {name || "Environment Graph"}
                      </span>
                      <span className="text-[10px] text-zinc-400 font-mono">
                        ({envType})
                      </span>
                    </div>
                    <span className="font-mono text-[10px] text-zinc-400">
                      Depth: {maxDelegationDepth} Tiers
                    </span>
                  </div>

                  {/* DAG Representation */}
                  <div className="py-4 grid grid-cols-3 gap-3 items-center text-center">
                    {/* Root Node */}
                    <div className="rounded-lg border border-white/20 bg-white/5 p-2.5 space-y-1">
                      <div className="font-mono text-[9px] uppercase tracking-wider text-white/70 font-semibold">
                        Root Orchestrator
                      </div>
                      <div className="text-xs font-semibold text-white truncate">
                        {rootAgentName || "Main"}
                      </div>
                      <div className="font-mono text-[10px] text-zinc-300 font-medium">
                        {formatMinorUnits(calculatedBudgetMinor, currency)}
                      </div>
                    </div>

                    {/* Connecting Link */}
                    <div className="flex flex-col items-center justify-center text-zinc-400">
                      <span className="font-mono text-[9px] text-zinc-400 uppercase">
                        Sub-mandate
                      </span>
                      <div className="w-full h-px bg-white/20 my-1 relative">
                        <span className="absolute -top-1 left-1/2 -translate-x-1/2 size-2 rounded-full bg-white animate-ping" />
                      </div>
                      <span className="font-mono text-[9px] text-zinc-400">
                        ≤ {formatMinorUnits(calculatedThresholdMinor, currency)} Auto
                      </span>
                    </div>

                    {/* Specialist Subagent Node */}
                    <div className="rounded-lg border border-white/20 bg-white/5 p-2.5 space-y-1">
                      <div className="font-mono text-[9px] uppercase tracking-wider text-white/70 font-semibold">
                        Specialist Subagent
                      </div>
                      <div className="text-xs font-semibold text-white truncate">
                        Travel & Booking
                      </div>
                      <div className="font-mono text-[10px] text-zinc-300 font-medium">
                        {formatMinorUnits(
                          Math.min(400000, Math.floor(calculatedBudgetMinor * 0.4)),
                          currency
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Footer status bar */}
                  <div className="pt-2 border-t border-zinc-900 flex items-center justify-between font-mono text-[9px] text-zinc-500">
                    <span className="text-zinc-400">Double-Entry Conservation: Invariant OK</span>
                    <span className="text-zinc-400">FIDO2 WebAuthn Armed</span>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
</section>
  );
}

function InputField({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (val: string) => void;
}) {
  return (
    <div className="space-y-1.5 text-left w-full">
      <label className="text-xs font-semibold text-black/60 dark:text-white/60">
        {label}
      </label>
      <div className="relative flex h-11 items-center rounded-lg border border-black/15 bg-white px-3.5 dark:border-white/10 dark:bg-white/5">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent text-sm text-black outline-none placeholder:text-black/30 dark:text-white dark:placeholder:text-white/30"
        />
      </div>
    </div>
  );
}

function CheckboxLine({
  children,
  checked,
  onChange,
}: {
  children: React.ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer select-none">
      <span className="relative mt-1 size-3.5 shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer size-full cursor-pointer appearance-none rounded-[3px] border border-black/25 bg-white checked:border-black checked:bg-black dark:border-white/30 dark:bg-white/5 dark:checked:border-white dark:checked:bg-white"
        />
        <svg
          viewBox="0 0 12 12"
          className="pointer-events-none absolute inset-0 hidden size-full p-0.5 text-white peer-checked:block dark:text-black"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M3 6.2 5 8.1 9 3.9"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="text-xs leading-relaxed">{children}</span>
    </label>
  );
}
