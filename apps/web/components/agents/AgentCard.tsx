"use client";

import * as React from "react";
import {
  Plane,
  Cloud,
  ShoppingCart,
  DollarSign,
  Network,
  ShieldCheck,
  Eye,
  PlusCircle,
  CheckCircle2,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { formatMinorUnits } from "../../app/lib/currency";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import type { SpecialistAgent } from "./types";

export interface AgentCardProps {
  agent: SpecialistAgent;
  onInspect: (agent: SpecialistAgent) => void;
  onAttach: (agent: SpecialistAgent) => void;
  isAttached?: boolean;
  /** Workspace graph node status, when attached. Drives the status badge. */
  status?: "active" | "revoked" | "paused" | "unfunded";
  className?: string;
}

export function AgentCard({
  agent,
  onInspect,
  onAttach,
  isAttached = false,
  status,
  className = "",
}: AgentCardProps) {
  const getIcon = () => {
    switch (agent.avatarIcon) {
      case "plane":
        return <Plane className="h-4 w-4 text-foreground" />;
      case "cloud":
        return <Cloud className="h-4 w-4 text-foreground" />;
      case "shopping-cart":
        return <ShoppingCart className="h-4 w-4 text-foreground" />;
      case "dollar-sign":
        return <DollarSign className="h-4 w-4 text-foreground" />;
      case "network":
        return <Network className="h-4 w-4 text-foreground" />;
      case "shield-check":
        return <ShieldCheck className="h-4 w-4 text-foreground" />;
      default:
        return <ShieldCheck className="h-4 w-4 text-foreground" />;
    }
  };

  const statusBadge = () => {
    if (!isAttached) return <Badge variant="secondary">Available</Badge>;
    if (status === "unfunded") return <Badge variant="unfunded">Unfunded</Badge>;
    return <Badge variant="success">Attached</Badge>;
  };

  return (
    <div
      className={cn(
        "group flex flex-col rounded-md border border-border bg-card p-4 transition-colors hover:border-input",
        className,
      )}
    >
      {/* Header: icon tile + status badge, then full-width title on its own line */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-secondary">
          {getIcon()}
        </div>
        {statusBadge()}
      </div>

      <h3 className="mt-3 line-clamp-2 text-sm font-medium text-foreground">{agent.name}</h3>
      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
        {agent.specialty} · {agent.publisher}
      </p>

      {/* 2-line description; min-height keeps footers aligned across the grid */}
      <p className="mt-3 line-clamp-2 min-h-[2.5rem] text-xs leading-relaxed text-muted-foreground">
        {agent.tagline}
      </p>

      {/* Footer: actions row + metadata on its own full-width line */}
      <div className="mt-auto border-t border-border pt-3">
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onInspect(agent)}
            className="h-7 px-2.5 text-xs"
          >
            <Eye className="h-3.5 w-3.5" />
            Open
          </Button>
          {isAttached ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onAttach(agent)}
              className="h-7 px-2 text-xs"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Attached
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onAttach(agent)}
              className="h-7 px-2.5 text-xs"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              Attach
            </Button>
          )}
        </div>
        <p className="mt-2 truncate text-[11px] text-muted-foreground">
          <span className="capitalize">{agent.role}</span>
          {" · "}
          <span>Rec. Limit: {formatMinorUnits(agent.recommendedBudgetMinor, agent.currency)}</span>
        </p>
      </div>
    </div>
  );
}
