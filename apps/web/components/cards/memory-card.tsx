"use client";

import * as React from "react";
import { Bookmark, Clock, Info, RotateCcw } from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";

export type MemoryCategory = "session" | "environment" | "agent";

export interface MemoryCardProps {
  id?: string;
  category?: MemoryCategory;
  keyName?: string;
  value?: string;
  contextSnippet?: string;
  agentName?: string;
  savedAt?: string;
  onUndo?: (id: string) => void;
  className?: string;
}

export function MemoryCard({
  id = "",
  category = "environment",
  keyName = "",
  value = "",
  contextSnippet,
  agentName = "Agent",
  savedAt = new Date().toISOString(),
  onUndo,
  className = "",
}: MemoryCardProps) {
  const [isUndone, setIsUndone] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);

  const handleUndo = () => {
    setIsUndone(true);
    setShowConfirm(false);
    onUndo?.(id);
  };

  return (
    <div
      className={`relative rounded-lg border border-border bg-card p-4 text-foreground top-shade verified-glow transition-opacity ${
        isUndone ? "opacity-50" : ""
      } ${className}`}
    >
      {/* Header with Category & Timestamp */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <Badge variant="authorized" showDot className="bg-success/10 text-success border-success/30">
            <Bookmark className="h-3 w-3 mr-1" />
            DURABLE MEMORY SAVED
          </Badge>
          <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] uppercase font-mono text-muted-foreground border border-border">
            {category}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
          <Clock className="h-3 w-3" />
          <span>
            {savedAt ? new Date(savedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
          </span>
        </div>
      </div>

      {/* Memory Content */}
      <div className="mt-3">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">Memory Key</div>
        <div className="font-mono text-xs font-semibold text-foreground">{keyName || "unnamed_key"}</div>

        <div className="mt-1.5 rounded-md border border-border bg-secondary p-2.5 text-xs text-foreground leading-relaxed">
          {value || "No value recorded"}
        </div>

        {contextSnippet && (
          <div className="mt-2 text-[11px] text-muted-foreground italic">
            Context: &ldquo;{contextSnippet}&rdquo;
          </div>
        )}
      </div>

      {/* MANDATORY SECURITY INVARIANT DISCLAIMER */}
      <div className="mt-3 flex items-start gap-1.5 rounded border border-border bg-secondary/50 p-2 text-[11px] text-muted-foreground">
        <Info className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
        <span>
          <strong className="text-foreground">Security Notice:</strong> Memory never grants spending permission. Authority can only be granted via signed cryptographic mandates.
        </span>
      </div>

      {/* Action Footer */}
      <div className="mt-3.5 flex items-center justify-between pt-2 border-t border-border">
        <span className="text-[10px] text-muted-foreground">
          Recorded by <span className="text-muted-foreground font-medium">{agentName}</span>
        </span>

        {isUndone ? (
          <span className="text-xs text-muted-foreground italic">Memory revoked / removed</span>
        ) : showConfirm ? (
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowConfirm(false)}
              className="h-6 px-2 text-[10px]"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleUndo}
              className="h-6 px-2 text-[10px]"
            >
              Confirm Forget
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowConfirm(true)}
            className="h-7 px-2.5 text-xs text-muted-foreground hover:text-destructive hover:border-destructive/40"
          >
            <RotateCcw className="mr-1 h-3 w-3" />
            Undo / Forget
          </Button>
        )}
      </div>
    </div>
  );
}
