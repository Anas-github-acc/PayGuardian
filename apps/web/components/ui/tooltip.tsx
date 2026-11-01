"use client";

import * as React from "react";
import { cn } from "../../lib/utils";

interface TooltipContextType {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const TooltipContext = React.createContext<TooltipContextType | null>(null);

function useTooltip(): TooltipContextType {
  const context = React.useContext(TooltipContext);
  if (!context) {
    throw new Error("Tooltip components must be used within a <Tooltip />");
  }
  return context;
}

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function Tooltip({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);

  return (
    <TooltipContext.Provider value={{ open, setOpen }}>
      <div className="relative inline-flex items-center">{children}</div>
    </TooltipContext.Provider>
  );
}

export const TooltipTrigger = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ onMouseEnter, onMouseLeave, onFocus, onBlur, ...props }, ref) => {
  const { setOpen } = useTooltip();

  return (
    <div
      ref={ref}
      tabIndex={0}
      onMouseEnter={(e) => {
        onMouseEnter?.(e);
        setOpen(true);
      }}
      onMouseLeave={(e) => {
        onMouseLeave?.(e);
        setOpen(false);
      }}
      onFocus={(e) => {
        onFocus?.(e);
        setOpen(true);
      }}
      onBlur={(e) => {
        onBlur?.(e);
        setOpen(false);
      }}
      className="inline-flex cursor-pointer focus:outline-none"
      {...props}
    />
  );
});
TooltipTrigger.displayName = "TooltipTrigger";

export interface TooltipContentProps extends React.HTMLAttributes<HTMLDivElement> {
  side?: "top" | "bottom" | "left" | "right";
}

const sideStyles = {
  top: "bottom-full mb-2 left-1/2 -translate-x-1/2",
  bottom: "top-full mt-2 left-1/2 -translate-x-1/2",
  left: "right-full mr-2 top-1/2 -translate-y-1/2",
  right: "left-full ml-2 top-1/2 -translate-y-1/2",
};

export const TooltipContent = React.forwardRef<HTMLDivElement, TooltipContentProps>(
  ({ className, side = "top", children, ...props }, ref) => {
    const { open } = useTooltip();
    if (!open) return null;

    return (
      <div
        ref={ref}
        role="tooltip"
        className={cn(
          "absolute z-50 whitespace-nowrap rounded-md border border-border bg-secondary px-2.5 py-1 text-[11px] font-medium text-foreground shadow-lg top-shade pointer-events-none animate-in fade-in-0 zoom-in-95 duration-100",
          sideStyles[side],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
TooltipContent.displayName = "TooltipContent";
