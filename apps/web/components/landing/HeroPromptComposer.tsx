"use client";

import React, { useEffect, useState, useRef } from "react";
import { animate } from "animejs";
import {
  Plus,
  ChevronDown,
  Mic,
  ArrowUp,
  MessageSquare,
  Compass,
  Shield,
  Check,
} from "lucide-react";

export type ComposerMode = "Delegate" | "Ask" | "Plan";

interface ModeOption {
  mode: ComposerMode;
  label: string;
  desc: string;
  icon: React.ReactNode;
}

const MODES: ModeOption[] = [
  {
    mode: "Ask",
    label: "Ask",
    desc: "Query balances, headroom & audit status",
    icon: <MessageSquare className="size-3.5 text-blue-400" />,
  },
  {
    mode: "Plan",
    label: "Plan",
    desc: "Draft multi-agent trees & budget limits",
    icon: <Compass className="size-3.5 text-amber-400" />,
  },
  {
    mode: "Delegate",
    label: "Delegate",
    desc: "Issue cryptographically signed subagent mandate",
    icon: <Shield className="size-3.5 text-emerald-400" />,
  },
];

const PROMPTS_BY_MODE: Record<ComposerMode, string[]> = {
  Delegate: [
    "Delegate, Ask, Automate / @ for context",
    "Delegate ₹2,500 to Transport Agent with 24h expiration",
    "Authorize Flight SFO → JFK under ₹3,200 with PayPal Sandbox",
    "Enforce $100 daily spend cap across all subagent trees",
    "Revoke mandate sub_travel_09 and release reserved headroom",
  ],
  Ask: [
    "Ask: What are active subagent spending limits this week?",
    "Ask: Show remaining headroom for Travel Specialist mandate",
    "Ask: Which agents settled payments in PayPal Sandbox today?",
  ],
  Plan: [
    "Plan: Map vacation budget hierarchy: Root → Travel → Hotel & Flight",
    "Plan: Generate cryptographic mandate hierarchy for 4 subagents",
    "Plan: Configure fallback payment provider with $50 cap",
  ],
};

export function HeroPromptComposer() {
  const [selectedMode, setSelectedMode] = useState<ComposerMode>("Delegate");
  const [isModeDropdownOpen, setIsModeDropdownOpen] = useState(false);
  const [promptIndex, setPromptIndex] = useState(0);
  const [displayText, setDisplayText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const textRef = useRef<HTMLSpanElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsModeDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Subtle anime.js floating glow / breathing effect on mount
  useEffect(() => {
    if (containerRef.current) {
      animate(containerRef.current, {
        boxShadow: [
          "0 16px 40px -10px rgba(0, 0, 0, 0.7), 0 0 20px 0 rgba(255, 255, 255, 0.03)",
          "0 20px 48px -10px rgba(0, 0, 0, 0.8), 0 0 28px 2px rgba(255, 255, 255, 0.06)",
        ],
        direction: "alternate",
        loop: true,
        ease: "inOutQuad",
        duration: 3500,
      });
    }
  }, []);

  // Writing prompt typewriter animation
  useEffect(() => {
    const currentPrompts = PROMPTS_BY_MODE[selectedMode];
    const currentFullPrompt = currentPrompts[promptIndex % currentPrompts.length];
    let timeout: NodeJS.Timeout;

    if (!isDeleting) {
      // Typing forward
      if (displayText.length < currentFullPrompt.length) {
        timeout = setTimeout(() => {
          setDisplayText(currentFullPrompt.slice(0, displayText.length + 1));
        }, 38 + Math.random() * 25);
      } else {
        // Finished typing full prompt, pause before deleting
        timeout = setTimeout(() => {
          setIsDeleting(true);
        }, 2800);
      }
    } else {
      // Deleting back to empty
      if (displayText.length > 0) {
        timeout = setTimeout(() => {
          setDisplayText(displayText.slice(0, -1));
        }, 20);
      } else {
        // Done deleting, switch to next prompt
        setIsDeleting(false);
        setPromptIndex((prev) => (prev + 1) % currentPrompts.length);
      }
    }

    return () => clearTimeout(timeout);
  }, [displayText, isDeleting, promptIndex, selectedMode]);

  const handleSelectMode = (mode: ComposerMode) => {
    setSelectedMode(mode);
    setIsModeDropdownOpen(false);
    setDisplayText("");
    setIsDeleting(false);
    setPromptIndex(0);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full rounded-[14px] border border-white/10 bg-[#121212]/95 p-3.5 backdrop-blur-md shadow-[0_16px_40px_rgba(0,0,0,0.7)] ring-1 ring-white/5 sm:p-4 text-left select-none transition-all"
    >
      {/* Top Row: Animated prompt typing */}
      <div className="flex min-h-[30px] items-center text-[14px] leading-snug sm:text-[15px]">
        <span
          ref={textRef}
          className={
            displayText.startsWith("Delegate, Ask") && !isDeleting
              ? "text-muted-foreground/80"
              : "text-foreground/90 font-normal"
          }
        >
          {displayText}
        </span>
        <span className="ml-0.5 inline-block h-[16px] w-[2px] bg-primary animate-[pulse_1s_infinite]" />
      </div>

      {/* Bottom Action Bar */}
      <div className="mt-3 flex items-center justify-between gap-2 pt-1 border-t border-white/[0.04]">
        {/* Left Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-0.5">
          {/* Plus Button */}
          <button
            type="button"
            aria-label="Add attachment"
            className="flex size-7 sm:size-8 shrink-0 items-center justify-center rounded-[8px] border border-white/10 bg-white/5 text-muted-foreground transition-all hover:bg-white/10 hover:text-foreground active:scale-95"
          >
            <Plus className="size-3.5 sm:size-4" />
          </button>

          {/* Mode Selector Pill with Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsModeDropdownOpen((prev) => !prev)}
              className="flex h-7 sm:h-8 shrink-0 items-center gap-1.5 rounded-[8px] border border-white/10 bg-white/5 px-2.5 sm:px-3 text-[12px] sm:text-[13px] font-medium text-foreground/90 transition-all hover:bg-white/10 active:scale-95"
            >
              <span>{selectedMode}</span>
              <ChevronDown
                className={`size-3 text-muted-foreground transition-transform duration-200 ${
                  isModeDropdownOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {/* Dropdown Menu Popup */}
            {isModeDropdownOpen && (
              <div className="absolute bottom-[calc(100%+8px)] left-0 z-50 w-[220px] rounded-[12px] border border-white/10 bg-[#181818] p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.8)] backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
                <div className="px-2 py-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                  Select Mode
                </div>
                {MODES.map((item) => (
                  <button
                    key={item.mode}
                    type="button"
                    onClick={() => handleSelectMode(item.mode)}
                    className={`flex w-full items-center gap-2.5 rounded-[8px] px-2.5 py-1.5 text-left text-[13px] transition-colors ${
                      selectedMode === item.mode
                        ? "bg-white/10 font-semibold text-foreground"
                        : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                    }`}
                  >
                    <span className="shrink-0">{item.icon}</span>
                    <span className="flex-1 leading-snug">{item.label}</span>
                    {selectedMode === item.mode && (
                      <Check className="size-3.5 text-primary" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Model Selector Pill */}
          <button
            type="button"
            className="flex h-7 sm:h-8 shrink-0 items-center gap-1.5 sm:gap-2 rounded-[8px] border border-white/10 bg-white/5 px-2.5 sm:px-3 text-[12px] sm:text-[13px] font-medium text-foreground/90 transition-all hover:bg-white/10 active:scale-95"
          >
            {/* 4-point Sparkle Icon */}
            <svg
              className="size-3.5 text-foreground/85 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
            </svg>
            <span className="truncate max-w-[130px] sm:max-w-none">
              APInex GPT-6 Luna (Free)
            </span>
            <span className="text-[11px] sm:text-[12px] text-muted-foreground font-normal">
              Medium
            </span>
            <ChevronDown className="size-3 text-muted-foreground ml-0.5" />
          </button>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Microphone Button */}
          <button
            type="button"
            aria-label="Voice input"
            className="flex size-7 sm:size-8 items-center justify-center rounded-[8px] border border-white/10 bg-white/5 text-muted-foreground transition-all hover:bg-white/10 hover:text-foreground active:scale-95"
          >
            <Mic className="size-3.5 sm:size-4" />
          </button>

          {/* Send / Arrow Up Button */}
          <button
            type="button"
            aria-label="Send prompt"
            className="flex size-7 sm:size-8 items-center justify-center rounded-[8px] border border-white/10 bg-white/5 text-muted-foreground transition-all hover:bg-white/10 hover:text-foreground active:scale-95"
          >
            <ArrowUp className="size-3.5 sm:size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
