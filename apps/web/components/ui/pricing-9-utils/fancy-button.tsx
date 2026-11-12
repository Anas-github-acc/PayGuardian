"use client";

import * as React from "react";
import { cn } from "../../../lib/utils";

export interface FancyButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: "default" | "sm" | "lg";
}

export const FancyButton = React.forwardRef<HTMLButtonElement, FancyButtonProps>(
  ({ className, size = "default", children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "group relative inline-flex items-center justify-center gap-2 rounded-xl bg-primary font-medium text-primary-foreground shadow-[0_0_20px_-3px_rgba(255,255,255,0.15)] transition-all hover:bg-primary/90 hover:shadow-[0_0_25px_-2px_rgba(255,255,255,0.25)] active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
          size === "sm" && "h-9 px-3 text-xs",
          size === "default" && "h-11 px-5 text-sm",
          size === "lg" && "h-12 px-6 text-base font-semibold",
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);
FancyButton.displayName = "FancyButton";
