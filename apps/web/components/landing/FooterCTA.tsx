"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, MessageSquare } from "lucide-react";
import { BotIcon } from "@/components/ui/bot-icon";
import { useAuth } from "@/app/auth-provider";
import { Section9BackgroundSvg } from "./BackgroundSvgs";

export function FooterCTA() {
  const { user } = useAuth();
  return (
    <section className="relative overflow-hidden border-t border-border bg-background px-4 pt-[40px] pb-[48px] text-center md:pt-[56px] md:pb-[64px]">
      {/* Background SVG Grid Matrix */}
      <div className="absolute inset-0 opacity-40">
        <Section9BackgroundSvg />
      </div>

      {/* Floating Model Badges with subtle Framer Motion floating loop */}
      <div
        aria-hidden={true}
        className="pointer-events-none absolute top-0 left-1/2 h-full w-[1440px] -translate-x-1/2 select-none max-lg:hidden"
      >
        {/* Left Badge 1: OpenAI */}
        <motion.span
          animate={{ y: [0, -7, 0] }}
          transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
          className="absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-border bg-background shadow-[0_6px_16px_rgba(0,0,0,0.15)]"
          style={{ left: "357.5px", top: "50px", width: "46px", height: "46px" }}
        >
          <span className="grid place-items-center" style={{ width: "26px", height: "26px" }}>
            <Image
              alt="OpenAI"
              className="size-full object-contain"
              height={26}
              width={26}
              src="/landing/openai.1z8ot1lxof1ck.svg"
            />
          </span>
        </motion.span>

        {/* Left Badge 2: Copilot */}
        <motion.span
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
          className="absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-border bg-background shadow-[0_6px_16px_rgba(0,0,0,0.15)]"
          style={{ left: "214.5px", top: "203px", width: "77px", height: "77px" }}
        >
          <span className="grid place-items-center" style={{ width: "36px", height: "36px" }}>
            <Image
              alt="Microsoft Copilot"
              className="size-full object-contain"
              height={40}
              width={44}
              src="/landing/microsoft-copilot.1k597barwg6ia.svg"
            />
          </span>
        </motion.span>

        {/* Left Badge 3: DeepSeek */}
        <motion.span
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-border bg-background shadow-[0_6px_16px_rgba(0,0,0,0.15)]"
          style={{ left: "387px", top: "319px", width: "52px", height: "52px" }}
        >
          <span className="grid place-items-center" style={{ width: "30px", height: "30px" }}>
            <Image
              alt="DeepSeek"
              className="size-full object-contain"
              height={24}
              width={24}
              src="/landing/deepseek.2s6gyjzmgf_ox.svg"
            />
          </span>
        </motion.span>

        {/* Right Badge 1: Gemini */}
        <motion.span
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
          className="absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-border bg-background shadow-[0_6px_16px_rgba(0,0,0,0.15)]"
          style={{ left: "1102px", top: "60px", width: "46px", height: "46px" }}
        >
          <span className="grid place-items-center" style={{ width: "25px", height: "25px" }}>
            <Image
              alt="Gemini"
              className="size-full object-contain"
              height={298}
              width={296}
              src="/landing/gemini.0i0maf4iixpdu.svg"
            />
          </span>
        </motion.span>

        {/* Right Badge 2: OpenAI Large */}
        <motion.span
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.7 }}
          className="absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-border bg-background shadow-[0_6px_16px_rgba(0,0,0,0.15)]"
          style={{ left: "1238px", top: "201px", width: "77px", height: "77px" }}
        >
          <span className="grid place-items-center" style={{ width: "50px", height: "50px" }}>
            <Image
              alt="OpenAI"
              className="size-full object-contain"
              height={611}
              width={611}
              src="/landing/openai.1z8ot1lxof1ck.svg"
            />
          </span>
        </motion.span>

        {/* Right Badge 3: Linear */}
        <motion.span
          animate={{ y: [0, 5, 0] }}
          transition={{ duration: 4.1, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}
          className="absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-border bg-background shadow-[0_6px_16px_rgba(0,0,0,0.15)]"
          style={{ left: "1051.5px", top: "329px", width: "46px", height: "46px" }}
        >
          <span className="grid place-items-center" style={{ width: "27px", height: "27px" }}>
            <Image
              alt="Linear"
              className="size-full object-contain"
              height={24}
              width={24}
              src="/landing/linear.3xpqc5i-u01rs.svg"
            />
          </span>
        </motion.span>
      </div>

      {/* Main Content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.6 }}
        className="relative z-10"
      >
        <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3.5 py-1 text-[13px] font-medium text-foreground">
          <Sparkles className="size-3.5 text-amber-500" />
          <span>Start Delegating in 5 Minutes</span>
        </div>

        <h2 className="text-[30px] leading-[36px] font-semibold tracking-[-0.012em] text-foreground md:text-[42px] md:leading-[48px]">
          Your agents are already executing tasks.
          <br className="max-md:hidden" />
          Make sure their spending is bounded.
        </h2>
        <p className="mt-[14px] text-[14px] leading-[25px] text-muted-foreground">
          Start enforcing cryptographic mandates across Personal, Travel, and Specialist agents
          today,
          <br className="max-md:hidden" />
          and see your first real-time ledger report in minutes.
        </p>

        <div className="mt-[28px] flex justify-center gap-[14px] text-[14px] font-medium">
          <Link
            className="inline-flex h-[42px] items-center justify-center gap-2 rounded-[10px] bg-primary px-[22px] text-primary-foreground font-medium transition-all hover:bg-primary/90 hover:shadow-lg hover:shadow-white/10 active:scale-[0.98]"
            href={user ? "/dashboard" : "/login"}
          >
            <span>{user ? "Dashboard" : "Get started for free"}</span>
            <ArrowRight className="size-4" />
          </Link>
          <Link
            className="inline-flex h-[42px] items-center justify-center gap-2 rounded-[10px] border border-border bg-muted px-[22px] text-foreground/85 font-medium transition-colors hover:bg-accent hover:text-foreground cursor-pointer"
            href="/icognito"
          >
            <BotIcon size={18} className="text-primary shrink-0" />
            <span>Ask agent</span>
          </Link>
        </div>

        <p className="mt-[14px] text-[12.5px] text-muted-foreground">
          100% Free Public Beta · Unlimited access to all features · No credit card required
        </p>
      </motion.div>
    </section>
  );
}
