"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { X, Sparkles } from "lucide-react";
import { AIAvatar } from "@/components/ui/ai-avatar";
import { AskAgentButton } from "@/components/ui/ask-agent-button";

const STORAGE_KEY = "payguardian_has_seen_agent_overlay_v1";

export function FirstTimeAgentOverlay() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    try {
      const hasSeen = localStorage.getItem(STORAGE_KEY);
      const searchParams = new URLSearchParams(window.location.search);
      const forceOpen =
        searchParams.get("agent_modal") === "1" ||
        searchParams.get("intro") === "1" ||
        searchParams.get("ask_agent") === "1";

      if (!hasSeen || forceOpen) {
        // Subtle entrance delay for a smooth first impression
        const timer = setTimeout(() => {
          setIsOpen(true);
        }, 700);
        return () => clearTimeout(timer);
      }
    } catch {
      // In case localStorage is disabled/restricted
    }

    // Custom listener so any button or test trigger can open it on demand
    const handleManualOpen = () => setIsOpen(true);
    window.addEventListener("open-payguardian-agent-overlay", handleManualOpen);

    return () => {
      window.removeEventListener("open-payguardian-agent-overlay", handleManualOpen);
    };
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      // storage unavailable
    }
  }, []);

  // Keyboard escape listener
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleClose]);

  const handleAskAgentClick = () => {
    handleClose();
    router.push("/icognito");
  };

  if (!mounted) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="agent-overlay-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/75 backdrop-blur-sm cursor-pointer"
          />

          {/* Overlay Card - Layout strictly mirrors the wireframe:
              1. AI Avatar on top
              2. Rounded Text Box in middle
              3. Ask Agent Button at bottom
          */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 12 }}
            transition={{ type: "spring", damping: 25, stiffness: 320 }}
            className="relative z-10 flex w-full max-w-[420px] flex-col items-center rounded-[28px] border border-white/15 bg-[#0d0d10]/95 p-6 sm:p-8 text-center shadow-[0_25px_65px_-15px_rgba(0,0,0,0.95)] backdrop-blur-2xl select-none"
          >
            {/* Ambient subtle glow matching #d0785a */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 size-48 rounded-full bg-[#d0785a]/15 blur-3xl"
            />

            {/* Close Button */}
            <button
              type="button"
              onClick={handleClose}
              aria-label="Close dialog"
              className="absolute top-4 right-4 flex size-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-400 transition-all hover:bg-white/10 hover:text-white hover:scale-105 active:scale-95 cursor-pointer"
            >
              <X size={16} strokeWidth={2} />
            </button>

            {/* 1. TOP SECTION: AI Avatar */}
            <div className="relative mt-2 flex items-center justify-center">
              <div
                aria-hidden="true"
                className="absolute inset-0 size-36 sm:size-44 rounded-full bg-gradient-to-b from-[#d0785a]/25 to-transparent blur-xl pointer-events-none"
              />
              <AIAvatar
                color="orange"
                size="2xl"
                shape="circle"
                idleAnimate={true}
                className="shadow-[0_12px_36px_rgba(208,120,90,0.35)]"
              />
            </div>

            {/* 2. MIDDLE SECTION: Rounded Text Box */}
            <div className="mt-7 w-full rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5 shadow-inner">
              <div className="flex items-center justify-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#d0785a]">
                <Sparkles size={12} className="animate-pulse" />
                <span>AI Delegation Assistant</span>
              </div>
              <h2
                id="agent-overlay-title"
                className="mt-1.5 text-base sm:text-lg font-medium leading-snug tracking-tight text-white"
              >
                Ask our AI Agent anything about PayGuardian
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                Explore autonomous spending boundaries, mandate delegation trees, and cryptographic audit rails in real time.
              </p>
            </div>

            {/* 3. BOTTOM SECTION: Ask Agent Button with #d0785a moving line */}
            <div className="mt-6 w-full flex justify-center">
              <AskAgentButton
                onClick={handleAskAgentClick}
                size="lg"
                className="w-full"
                innerClassName="w-full justify-center text-sm sm:text-base font-semibold"
                text="Ask Agent"
              />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default FirstTimeAgentOverlay;
