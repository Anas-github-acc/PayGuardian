"use client";

import * as React from "react";
import {
  Plane,
  Cloud,
  ShoppingCart,
  DollarSign,
  Network,
  ShieldCheck,
  ShieldAlert,
  Copy,
  Check,
  PlusCircle,
  Sparkles,
  Lock,
} from "lucide-react";
import { formatMinorUnits } from "../../app/lib/currency";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "../ui/sheet";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import type { SpecialistAgent } from "./types";

export interface AgentDetailDrawerProps {
  agent: SpecialistAgent | null;
  isOpen: boolean;
  onClose: () => void;
  onAttach: (agent: SpecialistAgent) => void;
  isAttached?: boolean;
}

export function AgentDetailDrawer({
  agent,
  isOpen,
  onClose,
  onAttach,
  isAttached = false,
}: AgentDetailDrawerProps) {
  const [copiedIndex, setCopiedIndex] = React.useState<number | null>(null);
  const [copiedHash, setCopiedHash] = React.useState(false);

  if (!agent) return null;

  const handleCopyPrompt = (prompt: string, idx: number) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(prompt);
      setCopiedIndex(idx);
      setTimeout(() => setCopiedIndex(null), 1800);
    }
  };

  const handleCopyHash = (hash: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(hash);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 1800);
    }
  };

  const getIcon = () => {
    switch (agent.avatarIcon) {
      case "plane":
        return <Plane className="h-6 w-6 text-foreground" />;
      case "cloud":
        return <Cloud className="h-6 w-6 text-foreground" />;
      case "shopping-cart":
        return <ShoppingCart className="h-6 w-6 text-foreground" />;
      case "dollar-sign":
        return <DollarSign className="h-6 w-6 text-foreground" />;
      case "network":
        return <Network className="h-6 w-6 text-foreground" />;
      case "shield-check":
        return <ShieldCheck className="h-6 w-6 text-foreground" />;
      default:
        return <ShieldCheck className="h-6 w-6 text-foreground" />;
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg overflow-y-auto bg-card border-l border-border p-0 text-foreground shadow-2xl"
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="border-b border-border p-6 pb-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-secondary">
                  {getIcon()}
                </div>
                <div>
                  <h2 className="text-base font-semibold text-foreground tracking-tight">
                    {agent.name}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {agent.specialty} · <span className="text-muted-foreground">{agent.publisher}</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="text-[10px] font-mono">
                {agent.authorityTier}
              </Badge>
              <Badge variant="success" className="text-[10px] font-mono">
                Recommended: {formatMinorUnits(agent.recommendedBudgetMinor, agent.currency)}
              </Badge>
              <Badge variant="secondary" className="text-[10px] font-mono">
                Rails: {agent.supportedRails.join(", ")}
              </Badge>
            </div>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 p-6 space-y-6">
            {/* Overview & Description */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
                Overview
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-foreground">
                {agent.description}
              </p>
            </div>

            {/* Zero-Authority Invariant Banner */}
            <div className="rounded-lg border border-warning/30 bg-warning/10 p-3.5 text-xs text-warning/90 leading-relaxed">
              <div className="flex items-center gap-2 font-semibold text-warning">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span>Zero Spending Authority Invariant</span>
              </div>
              <p className="mt-1 text-[11px] text-warning/80">
                Attaching this specialist agent to an environment connects it as a structural node.
                It holds <strong>$0.00</strong> authority until an explicit delegated mandate is signed by
                the parent orchestrator.
              </p>
            </div>

            {/* Requested Permissions & Scopes */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono flex items-center gap-2">
                <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                Requested Permissions & Gateway Scopes
              </h3>
              <div className="mt-3 space-y-2">
                {agent.permissions.map((perm, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2.5 rounded-md border border-border bg-secondary p-2.5 text-xs text-muted-foreground"
                  >
                    <div className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
                    <span className="leading-snug">{perm}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Sample Prompt Patterns */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                Sample Prompt Patterns
              </h3>
              <div className="mt-3 space-y-2.5">
                {agent.samplePrompts.map((prompt, idx) => (
                  <div
                    key={idx}
                    className="group relative rounded-lg border border-border bg-card p-3 text-xs text-foreground transition-colors hover:border-input"
                  >
                    <p className="pr-8 italic leading-relaxed text-foreground">
                      &ldquo;{prompt}&rdquo;
                    </p>
                    <button
                      type="button"
                      onClick={() => handleCopyPrompt(prompt, idx)}
                      className="absolute right-2.5 top-2.5 rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      aria-label="Copy prompt"
                      title="Copy prompt"
                    >
                      {copiedIndex === idx ? (
                        <Check className="h-3.5 w-3.5 text-foreground" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Security & Cryptographic Audit Badge */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
                Security & Cryptographic Audit
              </h3>
              <div className="mt-3 rounded-lg border border-border bg-card p-4 text-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Audited Entity</span>
                  <span className="font-semibold text-foreground">
                    {agent.securityAudit.auditedBy}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-border pt-2">
                  <span className="text-muted-foreground">Audit Date</span>
                  <span className="font-mono text-muted-foreground">
                    {agent.securityAudit.auditDate}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-border pt-2">
                  <span className="text-muted-foreground">Known Vulnerabilities</span>
                  <span className="font-mono font-semibold text-foreground">
                    {agent.securityAudit.cveVulnerabilities} CVEs (Verified Clean)
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-border pt-2">
                  <span className="text-muted-foreground">Signature Hash</span>
                  <div className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                    <span className="max-w-[140px] truncate">
                      {agent.securityAudit.signatureHash}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyHash(agent.securityAudit.signatureHash)}
                      className="text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      aria-label="Copy signature hash"
                      title="Copy signature hash"
                    >
                      {copiedHash ? (
                        <Check className="h-3 w-3 text-foreground" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Action */}
          <div className="border-t border-border bg-card p-4">
            <Button
              variant="primary"
              className="w-full h-10 text-xs"
              onClick={() => {
                onClose();
                onAttach(agent);
              }}
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              {isAttached ? "Reconfigure Environment Delegation" : "Attach Agent to Environment"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
