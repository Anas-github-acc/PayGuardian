"use client";

import type React from "react";
import { ArrowRight, ArrowUpRight } from "lucide-react";

export interface LetsWorkTogetherProps {
  onAction?: () => void;
  onGetStarted?: () => void;
  onLearnMore?: () => void;
  actionText?: string;
  learnMoreText?: string;
  learnMoreUrl?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function LetsWorkTogether({
  onAction,
  onGetStarted,
  onLearnMore,
  actionText = "Get Started",
  learnMoreText = "Learn More",
  learnMoreUrl = "https://github.com",
  className = "",
  style,
}: LetsWorkTogetherProps = {}) {
  const handlePrimaryClick = () => {
    if (onGetStarted) {
      onGetStarted();
    } else if (onAction) {
      onAction();
    }
  };

  const handleSecondaryClick = () => {
    if (onLearnMore) {
      onLearnMore();
    } else if (learnMoreUrl) {
      window.open(learnMoreUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <section
      className={`relative flex h-full min-h-screen w-full items-center justify-center px-4 sm:px-6 py-4 sm:py-6 overflow-hidden text-white select-none bg-[#0a0a0c] dark:bg-[#0a0a0c] ${className}`}
      style={{
        backgroundColor: "rgb(10 10 12 / var(--tw-bg-opacity, 1))",
        backgroundImage:
          "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02) 45%, transparent 75%)",
        ...style,
      }}
    >
      {/* Subtle ambient light (black to white shades) */}
      <div className="pointer-events-none absolute -top-40 left-1/3 size-[550px] rounded-full bg-white/[0.04] blur-[140px]" />
      <div className="pointer-events-none absolute -top-32 right-1/4 size-[500px] rounded-full bg-zinc-400/[0.03] blur-[140px]" />

      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center text-center">
        {/* Narrative Statements */}
        <div className="flex flex-col items-center gap-3 sm:gap-5">
          {/* Main Statement 1 */}
          <h1 className="text-3xl font-light tracking-tight text-zinc-300 sm:text-5xl md:text-6xl lg:text-7xl leading-[1.12] max-w-4xl">
            Delegating work to subagents is easy.
          </h1>

          {/* Statement 2: Equally bigger to the main one */}
          <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl leading-[1.12] max-w-4xl">
            But delegating spending authority safely, with full accountability, is not.
          </h2>

          {/* Statement 3: A little smaller than main */}
          <p className="mt-1 sm:mt-2 max-w-2xl text-lg font-light tracking-tight text-zinc-400 sm:text-xl md:text-2xl leading-relaxed">
            That's why we built{" "}
            <span className="font-medium text-transparent bg-clip-text bg-gradient-to-r from-white via-zinc-200 to-zinc-400 tracking-normal">
              PayGuardian
            </span>
            .
          </p>
        </div>

        {/* Direct Action Buttons with decorative hairline accents */}
        <div className="mt-8 sm:mt-10 flex items-center justify-center gap-4 sm:gap-6">
          {/* Left hairline */}
          <div className="hidden h-px w-10 sm:w-16 bg-gradient-to-r from-transparent via-white/25 to-white/10 md:block" />

          <div className="flex flex-wrap items-center justify-center gap-3.5 sm:gap-4">
            {/* Get Started Button (no glow) */}
            <button
              type="button"
              onClick={handlePrimaryClick}
              className="group relative flex items-center gap-3 overflow-hidden rounded-full border border-white/20 bg-white px-7 py-3 sm:px-9 sm:py-3.5 text-black transition-all duration-300 hover:scale-[1.02] hover:bg-zinc-100 cursor-pointer"
            >
              <span className="text-sm sm:text-base font-semibold tracking-wide">{actionText}</span>
              <ArrowRight
                className="size-4 sm:size-5 transition-transform duration-300 group-hover:translate-x-1"
                strokeWidth={2}
              />
            </button>

            {/* Learn More Button */}
            <button
              type="button"
              onClick={handleSecondaryClick}
              className="group relative flex items-center gap-2.5 rounded-full border border-white/20 bg-white/5 px-6 py-3 sm:px-8 sm:py-3.5 text-zinc-300 backdrop-blur-md transition-all duration-300 hover:border-white/40 hover:bg-white/10 hover:text-white hover:scale-[1.02] cursor-pointer"
            >
              <span className="text-sm sm:text-base font-medium tracking-wide">
                {learnMoreText}
              </span>
              <ArrowUpRight
                className="size-4 sm:size-5 text-zinc-400 transition-all duration-300 group-hover:text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                strokeWidth={1.75}
              />
            </button>
          </div>

          {/* Right hairline */}
          <div className="hidden h-px w-10 sm:w-16 bg-gradient-to-l from-transparent via-white/25 to-white/10 md:block" />
        </div>
      </div>
    </section>
  );
}

export default LetsWorkTogether;
