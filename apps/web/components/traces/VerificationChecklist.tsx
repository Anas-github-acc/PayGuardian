"use client";

import * as React from "react";
import { Check, X, ShieldAlert, ShieldCheck, AlertTriangle } from "lucide-react";
import { Badge } from "../ui/badge";
import type { TraceVerificationCheck } from "./types";

export interface VerificationChecklistProps {
  checks: TraceVerificationCheck[];
  className?: string;
}

export function VerificationChecklist({
  checks,
  className = "",
}: VerificationChecklistProps) {
  const allPassed = checks.every((c) => c.passed);
  const failedCount = checks.filter((c) => !c.passed).length;

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
            Gateway Cryptographic Verification Matrix
          </h4>
          {allPassed ? (
            <Badge variant="authorized" showDot className="text-[10px] py-0 px-2">
              All 5 Checks Passed
            </Badge>
          ) : (
            <Badge variant="rejected" showDot className="text-[10px] py-0 px-2">
              {failedCount} Check Failed
            </Badge>
          )}
        </div>
        <span className="text-[11px] text-muted-foreground font-mono">
          Cryptographic Policy Engine
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2.5">
        {checks.map((check) => {
          return (
            <div
              key={check.id}
              className={`rounded-lg border p-3 text-xs transition-colors top-shade ${
                check.passed
                  ? "border-border bg-card hover:border-border"
                  : "border-destructive/40 bg-destructive/10"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <div
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                      check.passed
                        ? "bg-success/20 text-success"
                        : "bg-destructive/20 text-destructive"
                    }`}
                  >
                    {check.passed ? (
                      <Check className="h-3 w-3 stroke-[2.5]" />
                    ) : (
                      <X className="h-3 w-3 stroke-[2.5]" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-foreground">{check.name}</span>
                      {check.errorCode && (
                        <span className="font-mono text-[10px] text-destructive bg-destructive/10 px-1.5 py-[0.05rem] rounded border border-destructive/30">
                          {check.errorCode}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-muted-foreground leading-relaxed">
                      {check.description}
                    </p>
                    {check.details && (
                      <div className="mt-1.5 font-mono text-[11px] text-foreground">
                        Result: <span className={check.passed ? "text-success" : "text-destructive"}>{check.details}</span>
                      </div>
                    )}
                  </div>
                </div>

                <Badge
                  variant={check.passed ? "authorized" : "rejected"}
                  className="text-[10px] py-0 px-2 shrink-0"
                >
                  {check.passed ? "PASSED" : "FAILED"}
                </Badge>
              </div>

              {/* Remediation Guidance for Failed Checks */}
              {!check.passed && check.remediation && (
                <div className="mt-3 rounded border border-destructive/30 bg-destructive/5 p-2.5 text-[11px]">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-medium text-destructive">Recommended Remediation: </strong>
                      <span className="text-foreground">{check.remediation}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
