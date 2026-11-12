import * as React from "react";
import { cn } from "../../lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "warning" | "destructive" | "link";
  size?: "default" | "sm" | "lg" | "icon";
}

const variantStyles: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-primary text-primary-foreground font-medium shadow-sm hover:bg-primary/85 active:scale-[0.98]",
  secondary:
    "bg-secondary text-foreground border border-border font-medium hover:bg-muted hover:border-input active:scale-[0.98] top-shade",
  outline:
    "bg-transparent text-foreground border border-border font-medium hover:bg-secondary hover:border-input active:scale-[0.98]",
  ghost:
    "bg-transparent text-muted-foreground font-medium hover:text-foreground hover:bg-secondary active:scale-[0.98]",
  warning:
    "bg-warning text-background font-medium shadow-sm hover:bg-warning/85 active:scale-[0.98]",
  destructive:
    "bg-destructive text-white font-medium border border-destructive shadow-sm hover:bg-destructive-hover hover:border-destructive-hover active:scale-[0.98]",
  link: "text-link underline-offset-4 hover:underline p-0 h-auto font-normal bg-transparent",
};

const sizeStyles: Record<NonNullable<ButtonProps["size"]>, string> = {
  default: "h-9 px-4 py-2 text-xs gap-1.5",
  sm: "h-8 px-3 text-xs gap-1",
  lg: "h-10 px-5 text-sm gap-2",
  icon: "h-9 w-9 p-0",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "default", disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-md font-sans transition-all duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 select-none",
          variantStyles[variant],
          sizeStyles[size],
          className,
        )}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
