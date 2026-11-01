import * as React from "react";
import { cn } from "../../lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?:
    | "default"
    | "success"
    | "authorized"
    | "active"
    | "unfunded"
    | "pending"
    | "rejected"
    | "destructive"
    | "revoked"
    | "secondary";
  showDot?: boolean;
}

const badgeVariants: Record<NonNullable<BadgeProps["variant"]>, string> = {
  default: "bg-secondary text-foreground border-border",
  success: "bg-success/10 text-success border-success/30",
  authorized: "bg-success/10 text-success border-success/30",
  active: "bg-success/10 text-success border-success/30",
  unfunded: "bg-transparent text-muted-foreground border-dashed border-border",
  pending: "bg-warning/10 text-warning border-warning/30",
  rejected: "bg-destructive/10 text-destructive border-destructive/30",
  destructive: "bg-destructive/10 text-destructive border-destructive/30",
  revoked: "bg-secondary/40 text-muted-foreground border-border line-through",
  secondary: "bg-secondary text-muted-foreground border-border",
};

const dotColors: Record<NonNullable<BadgeProps["variant"]>, string> = {
  default: "bg-muted-foreground",
  success: "bg-success",
  authorized: "bg-success",
  active: "bg-success",
  unfunded: "bg-muted-foreground",
  pending: "bg-warning",
  rejected: "bg-destructive",
  destructive: "bg-destructive",
  revoked: "bg-muted-foreground",
  secondary: "bg-muted-foreground",
};

export function Badge({
  className,
  variant = "default",
  showDot = false,
  children,
  ...props
}: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium tracking-tight select-none",
        badgeVariants[variant],
        className
      )}
      {...props}
    >
      {showDot && (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full shrink-0",
            dotColors[variant]
          )}
        />
      )}
      <span>{children}</span>
    </div>
  );
}
