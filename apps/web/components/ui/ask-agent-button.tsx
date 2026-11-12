"use client";

import React from "react";
import Link from "next/link";
import { BotIcon } from "@/components/ui/bot-icon";
import { cn } from "@/lib/utils";

export interface AskAgentButtonProps {
  href?: string;
  onClick?: () => void;
  className?: string;
  innerClassName?: string;
  children?: React.ReactNode;
  icon?: React.ReactNode;
  showIcon?: boolean;
  size?: "sm" | "md" | "lg";
  rounded?: "default" | "full";
  text?: string;
  type?: "button" | "submit" | "reset";
}

const SIZE_STYLES = {
  sm: "h-[36px] px-3.5 text-xs sm:text-sm",
  md: "h-[42px] px-5 text-sm sm:text-[15px]",
  lg: "h-[48px] px-7 text-base font-medium",
};

export function AskAgentButton({
  href,
  onClick,
  className,
  innerClassName,
  children,
  icon,
  showIcon = true,
  size = "md",
  rounded = "default",
  text,
  type = "button",
}: AskAgentButtonProps) {
  const content = (
    <>
      {showIcon && (
        icon ?? (
          <BotIcon
            size={size === "sm" ? 16 : size === "lg" ? 20 : 18}
            className="text-[#d0785a] shrink-0 transition-transform duration-300 group-hover:scale-110"
          />
        )
      )}
      <span className="font-medium tracking-wide">
        {text ?? children ?? "Ask Agent"}
      </span>
    </>
  );

  const containerRadius = rounded === "full" ? "rounded-full" : "rounded-[12px]";
  const innerRadius = rounded === "full" ? "rounded-full" : "rounded-[10.5px]";

  const outerClasses = cn(
    "relative inline-flex items-center justify-center overflow-hidden p-[1.5px] transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] group cursor-pointer select-none",
    containerRadius,
    "shadow-[0_0_14px_rgba(208,120,90,0.22)] hover:shadow-[0_0_24px_rgba(208,120,90,0.45)]",
    className
  );

  const innerClasses = cn(
    "relative z-20 flex h-full w-full items-center justify-center gap-2.5 bg-[#0c0c0e]/95 hover:bg-[#15151a] text-zinc-200 hover:text-white transition-colors duration-200 backdrop-blur-md",
    innerRadius,
    SIZE_STYLES[size],
    innerClassName
  );

  // Background moving line element:
  // Conic-gradient rotating behind the padded border mask with exact color #d0785a
  const movingBorderLine = (
    <>
      {/* Subtle base border */}
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-0 border border-white/15 pointer-events-none z-10",
          containerRadius
        )}
      />
      {/* Moving #d0785a line around the border */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-[-250%] animate-ask-agent-border"
        style={{
          background:
            "conic-gradient(from 0deg at 50% 50%, transparent 0deg, transparent 270deg, rgba(208,120,90,0.15) 290deg, #d0785a 335deg, #ffd6c8 355deg, #d0785a 360deg)",
        }}
      />
    </>
  );

  if (href) {
    return (
      <Link href={href} onClick={onClick} className={outerClasses}>
        {movingBorderLine}
        <span className={innerClasses}>{content}</span>
      </Link>
    );
  }

  return (
    <button type={type} onClick={onClick} className={outerClasses}>
      {movingBorderLine}
      <span className={innerClasses}>{content}</span>
    </button>
  );
}

export default AskAgentButton;
