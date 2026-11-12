"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  Shield,
  ShieldCheck,
  Search,
  Command,
  Bell,
  Filter,
  Plus,
  Lock,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  PanelLeft,
  CircleArrowDown,
  Copy,
  Paperclip,
  ChevronDown,
  LayoutGrid,
  Bot,
  FileCheck2,
  Receipt,
  Scale,
  ArrowRight,
  MessageSquare,
} from "lucide-react";
import { useAuth } from "@/app/auth-provider";
import { HeroBackgroundSvg } from "./BackgroundSvgs";
import { HeroPromptComposer } from "./HeroPromptComposer";

export function LandingHero() {
  const { user } = useAuth();

  return (
    <section className="relative overflow-clip bg-background pb-[44px]">
      {/* Background SVG Grid Matrix */}
      <HeroBackgroundSvg />

      <div className="relative flex flex-col items-center px-4 pt-[56px] text-center md:pt-[100px]">
        {/* Version Badge */}
        <motion.span
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="flex h-[30px] items-center gap-[7px] rounded-[9px] border border-border bg-muted pr-[7px] pl-[10px] text-[14px] text-foreground"
        >
          Delegation Gateway
          <span className="rounded-[5px] bg-primary px-[4px] text-[10.5px] leading-[16px] font-bold text-primary-foreground">
            V1.0
          </span>
        </motion.span>

        {/* Hero Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="mt-[10px] w-full max-w-[1240px] text-[30px] leading-[38px] font-semibold tracking-[-0.005em] text-foreground sm:text-[46px] sm:leading-[54px] md:text-[60px] md:leading-[66px]"
        >
          <span className="block">Delegating tasks is easy.</span>
          <span className="block mt-1 sm:mt-0 lg:whitespace-nowrap">
            Delegating money
            <span className="mx-[0.27em] inline-grid size-[1em] place-items-center rounded-[0.27em] border border-border bg-background align-[-0.17em] shadow-[0_4px_12px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]">
              <Image
                src="/payguardian.svg"
                alt="PayGuardian"
                width={36}
                height={36}
                className="size-[0.62em] object-contain"
                priority
              />
            </span>
            safely isn’t.
          </span>
        </motion.h1>

        {/* Hero Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="mt-[16px] max-w-[740px] text-[15px] leading-[25px] text-foreground/80 md:text-[16.5px] md:leading-[27px]"
        >
          Agents are starting to hire other agents, and money moves down the chain
          with no one watching. PayGuardian is the trust layer that fixes this. You approve
          a budget once. PayGuardian splits it across your agents, enforces every limit at
          every level, and pays only what you authorized.
        </motion.p>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="mt-[28px] flex flex-wrap justify-center items-center gap-[14px] text-[15px] font-medium"
        >
          <Link
            className="inline-flex h-[40px] min-w-[150px] items-center justify-center gap-2 rounded-[11px] bg-primary px-[20px] text-primary-foreground font-medium transition-all hover:bg-primary/85 hover:shadow-lg hover:shadow-white/10 active:scale-[0.98]"
            href={user ? "/dashboard" : "/login"}
          >
            <span>{user ? "Dashboard" : "Get started free"}</span>
            <ArrowRight className="size-4" />
          </Link>
          <a
            className="inline-flex h-[40px] min-w-[145px] items-center justify-center gap-2 rounded-[10px] border border-border bg-muted px-[18px] text-foreground/85 font-medium transition-all hover:bg-accent hover:text-foreground active:scale-[0.98]"
            href="#ask-agent"
            onClick={(e) => {
              e.preventDefault();
              const el = document.getElementById("ask-agent");
              if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "center" });
              }
            }}
          >
            <MessageSquare className="size-4 text-primary" />
            <span>Learn more</span>
          </a>
        </motion.div>

        {/* Subtext info */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-[12px] text-[12.5px] text-muted-foreground"
        >
          100% Free Public Beta · Unlimited access · No credit card required
        </motion.p>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.45 }}
          className="mt-[4px] text-[12px] text-muted-foreground"
        >
          Crafted for{" "}
          <span className="underline underline-offset-4 text-foreground/90 font-medium">
            Autonomous Agentic Finance
          </span>
        </motion.p>

        {/* Bullet points */}
        <motion.ul
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-[32px] flex flex-wrap justify-center gap-x-[38px] gap-y-[10px] text-[14.5px] text-muted-foreground md:mt-[43px]"
        >
          <li className="flex items-center gap-[6px]">
            <svg aria-hidden="true" className="size-[14px]" viewBox="0 0 16 16">
              <circle cx="8" cy="8" fill="#3fbf6f" r="8" />
              <path
                d="M4.8 8.2l2.1 2.1 4.3-4.4"
                fill="none"
                stroke="#fff"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
              />
            </svg>
            Enforce bounded budgets
          </li>
          <li className="flex items-center gap-[6px]">
            <svg aria-hidden="true" className="size-[14px]" viewBox="0 0 16 16">
              <circle cx="8" cy="8" fill="#3fbf6f" r="8" />
              <path
                d="M4.8 8.2l2.1 2.1 4.3-4.4"
                fill="none"
                stroke="#fff"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
              />
            </svg>
            Cryptographic mandates
          </li>
          <li className="flex items-center gap-[6px]">
            <svg aria-hidden="true" className="size-[14px]" viewBox="0 0 16 16">
              <circle cx="8" cy="8" fill="#3fbf6f" r="8" />
              <path
                d="M4.8 8.2l2.1 2.1 4.3-4.4"
                fill="none"
                stroke="#fff"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
              />
            </svg>
            Instant subagent revocation
          </li>
        </motion.ul>
      </div>

      {/* Mock Dashboard Window with smooth entrance */}
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="relative mx-auto mt-[48px] w-[min(1204px,100%-32px)] md:mt-[60.25px]"
      >
        {/* Scaled browser mockup frame */}
        <div
          className="relative @container max-md:overflow-hidden max-md:rounded-[12px] max-md:[--fit-w:700]!"
          style={
            {
              "--fit-w": 1200,
              "--fit-h": 535,
              aspectRatio: "var(--fit-w) / var(--fit-h)",
            } as React.CSSProperties
          }
        >
          <div
            className="absolute top-0 left-0 origin-top-left"
            style={
              {
                width: "calc(var(--fit-w) * 1px)",
                height: "calc(var(--fit-h) * 1px)",
                scale: "tan(atan2(100cqw, var(--fit-w) * 1px))",
              } as React.CSSProperties
            }
          >
          <div
            aria-hidden="true"
            className="pointer-events-none relative h-[535px] w-[1200px] select-none"
          >
            <div className="drop-shadow-[0_-10px_50px_rgba(0,0,0,0.09)]">
              <div className="relative h-[520px] overflow-hidden rounded-[18px] border border-border bg-background [mask-image:linear-gradient(#000_240px,transparent_385px)]">
                {/* Browser window top bar */}
                <div className="relative flex h-[38px] items-center border-b border-border text-muted-foreground">
                  <div className="ml-[15px] flex gap-[7px]">
                    <span
                      className="size-[10px] rounded-full"
                      style={{ background: "#ec6a5f" }}
                    />
                    <span
                      className="size-[10px] rounded-full"
                      style={{ background: "#f4bf4f" }}
                    />
                    <span
                      className="size-[10px] rounded-full"
                      style={{ background: "#61c554" }}
                    />
                  </div>
                  <PanelLeft className="ml-[37px] size-[16px]" />
                  <ChevronLeft className="ml-[16px] size-[16px]" />
                  <ChevronRight className="ml-[10px] size-[16px] text-muted-foreground/70" />
                  <ShieldCheck className="ml-[166px] size-[14px] text-muted-foreground" />
                  <div className="relative ml-[10px] flex h-[24px] w-[485px] items-center justify-center gap-[4px] rounded-[6px] bg-secondary text-[10.5px] text-muted-foreground">
                    <Lock className="size-[9px]" />
                    gateway.payguardian.ai
                    <RotateCw className="absolute right-[6px] size-[12px] text-muted-foreground" />
                  </div>
                  <div className="ml-auto mr-[16px] flex gap-[11px]">
                    <CircleArrowDown className="size-[15px]" />
                    <Plus className="size-[15px]" />
                    <Copy className="size-[15px]" />
                  </div>
                </div>

                {/* Dashboard body */}
                <div className="flex h-full">
                  {/* Left Sidebar */}
                  <aside className="w-[216px] shrink-0 bg-card px-[20px]">
                    <div className="mt-[20px] flex h-[22px] items-center gap-[8px] text-[19px] font-semibold tracking-[-0.02em] text-foreground">
                      <Image
                        src="/payguardian.svg"
                        alt="PayGuardian Logo"
                        width={22}
                        height={20}
                        className="size-[20px] object-contain shrink-0"
                      />
                      PayGuardian
                    </div>
                    <ul className="mt-[38px] pl-[11px]">
                      <li className="flex h-[53.2px] items-center text-[13.5px] text-foreground font-medium">
                        <LayoutGrid className="-ml-[2px] size-[20px] text-foreground" />
                        <span className="ml-[11px]">Dashboard</span>
                      </li>
                      <li className="flex h-[53.2px] items-center text-[13.5px] text-muted-foreground/70">
                        <Bot className="-ml-[2px] size-[20px]" />
                        <span className="ml-[11px]">Agent Registry</span>
                        <ChevronDown className="ml-auto mr-[2px] size-[14px]" />
                      </li>
                      <li className="flex h-[53.2px] items-center text-[13.5px] text-muted-foreground/70">
                        <FileCheck2 className="-ml-[2px] size-[20px]" />
                        <span className="ml-[11px]">Mandates</span>
                        <ChevronDown className="ml-auto mr-[2px] size-[14px]" />
                      </li>
                      <li className="flex h-[53.2px] items-center text-[13.5px] text-muted-foreground/70">
                        <Receipt className="-ml-[2px] size-[20px]" />
                        <span className="ml-[11px]">Ledger Accounts</span>
                        <ChevronDown className="ml-auto mr-[2px] size-[14px]" />
                      </li>
                      <li className="flex h-[53.2px] items-center text-[13.5px] text-muted-foreground/70">
                        <Scale className="-ml-[2px] size-[20px]" />
                        <span className="ml-[11px]">Policies & Rules</span>
                        <ChevronDown className="ml-auto mr-[2px] size-[14px]" />
                      </li>
                    </ul>
                  </aside>

                  {/* Main content pane */}
                  <div className="flex-1 pr-[18.5px] pl-[22px]">
                    {/* Top bar inside dashboard */}
                    <div className="mt-[13px] flex h-[38px] items-center">
                      <h2 className="text-[19.5px] font-semibold tracking-[-0.01em] text-foreground">
                        Dashboard
                      </h2>
                      <div className="ml-[248px] flex h-[38px] w-[266px] items-center rounded-[9px] bg-background pr-[10px] pl-[9px] text-[12.5px] text-muted-foreground/70 shadow-[0_1px_3px_rgba(0,0,0,0.03)] border border-border">
                        <Search className="size-[15px] text-muted-foreground/70" />
                        <span className="ml-[7px]">Search agents, mandates...</span>
                        <Command className="ml-auto size-[12px] text-foreground/80" />
                        <span className="ml-[10px] text-[13px] font-medium text-foreground/80">
                          K
                        </span>
                      </div>
                      <span className="ml-auto grid size-[36px] place-items-center rounded-[9px] bg-background shadow-[0_1px_4px_rgba(0,0,0,0.05)] border border-border">
                        <ShieldCheck className="size-[17px] text-foreground/80" />
                      </span>
                      <span className="ml-[12px] grid size-[36px] place-items-center rounded-[9px] bg-background shadow-[0_1px_4px_rgba(0,0,0,0.05)] border border-border">
                        <Bell className="size-[17px] text-foreground/80" />
                      </span>
                    </div>

                    {/* Greeting & Action banner */}
                    <div className="mt-[20px] mr-[2.8px] flex h-[68px] items-center rounded-[12px] bg-muted pr-[15px] pl-[16px] border border-border">
                      <div className="text-left">
                        <div className="text-[16px] leading-[20px] font-semibold text-foreground">
                          Authority Gateway Live
                        </div>
                        <div className="mt-[1px] text-[11.5px] text-muted-foreground">
                          All 6 specialist subagents bounded under Personal root mandate
                        </div>
                      </div>
                      <span className="ml-auto flex h-[32px] w-[76px] items-center justify-center gap-[6px] rounded-[8px] bg-background text-[12px] text-muted-foreground shadow-[0_1px_4px_rgba(0,0,0,0.05)] border border-border">
                        <Filter className="size-[14px] text-foreground/80" />
                        Filter
                      </span>
                      <span className="ml-[14px] flex h-[32px] w-[148px] items-center justify-center gap-[5px] rounded-[8px] bg-primary text-[12px] font-medium text-primary-foreground">
                        <Plus className="size-[13px]" />
                        Issue Mandate
                      </span>
                    </div>

                    {/* Table of active delegations */}
                    <div className="mt-[31px] pl-[13.5px] text-left text-[12px] font-medium">
                      <div className="grid grid-cols-[24.5px_209px_176px_178px_176px_1fr] items-center h-[20px] text-muted-foreground">
                        <span className="size-[14px] rounded-[4px] border border-border" />
                        <span>Agent Entity</span>
                        <span>Delegation Scope</span>
                        <span>Mandate File</span>
                        <span>Authorized</span>
                        <span>Status</span>
                      </div>
                      <div className="mt-[13px]">
                        {/* Row 1 */}
                        <div className="grid grid-cols-[24.5px_209px_176px_178px_176px_1fr] items-center h-[50px] border-b border-border">
                          <span className="size-[14px] rounded-[4px] border border-border" />
                          <span className="flex items-center">
                            <Image
                              alt="Agent Personal"
                              className="size-[23px] rounded-full object-cover"
                              height={256}
                              width={256}
                              src="/landing/avatar-1.3c9mk9c-13we-.jpg"
                            />
                            <span className="ml-[10px]">
                              <span className="block text-[11.75px] leading-[15px] text-foreground/80 font-medium">
                                Personal Root Agent
                              </span>
                              <span className="block text-[10.5px] leading-[13px] text-muted-foreground">
                                root_user_01
                              </span>
                            </span>
                          </span>
                          <span className="text-[11.5px] text-foreground/80">
                            Travel & Living ₹10,000
                          </span>
                          <span className="flex items-center gap-[6px] text-[11.5px] text-foreground/80">
                            <Paperclip className="size-[13px] text-muted-foreground/70" />
                            mandate_root.sig
                          </span>
                          <span className="text-[11.5px] text-foreground/80">
                            12 Nov 2026
                          </span>
                          <span className="flex items-center text-[11.5px] text-emerald-500 font-semibold">
                            <span className="w-[62px] whitespace-nowrap">
                              Enforced
                            </span>
                            <ChevronRight className="size-[13px] text-muted-foreground/70" />
                          </span>
                        </div>

                        {/* Row 2 */}
                        <div className="grid grid-cols-[24.5px_209px_176px_178px_176px_1fr] items-center h-[50px] border-b border-border">
                          <span className="size-[14px] rounded-[4px] border border-border" />
                          <span className="flex items-center">
                            <Image
                              alt="Travel Agent"
                              className="size-[23px] rounded-full object-cover"
                              height={256}
                              width={256}
                              src="/landing/avatar-2.0787u8pfq-vwp.jpg"
                            />
                            <span className="ml-[10px]">
                              <span className="block text-[11.75px] leading-[15px] text-foreground/80 font-medium">
                                Travel Specialist Child
                              </span>
                              <span className="block text-[10.5px] leading-[13px] text-muted-foreground">
                                sub_travel_09
                              </span>
                            </span>
                          </span>
                          <span className="text-[11.5px] text-foreground/80">
                            Hotel & Flights ₹6,000
                          </span>
                          <span className="flex items-center gap-[6px] text-[11.5px] text-foreground/80">
                            <Paperclip className="size-[13px] text-muted-foreground/70" />
                            mandate_sub.sig
                          </span>
                          <span className="text-[11.5px] text-foreground/80">
                            12 Nov 2026
                          </span>
                          <span className="flex items-center text-[11.5px] text-emerald-500 font-semibold">
                            <span className="w-[62px] whitespace-nowrap">
                              Enforced
                            </span>
                            <ChevronRight className="size-[13px] text-muted-foreground/70" />
                          </span>
                        </div>

                        {/* Row 3 */}
                        <div className="grid grid-cols-[24.5px_209px_176px_178px_176px_1fr] items-center h-[50px]">
                          <span className="size-[14px] rounded-[4px] border border-border" />
                          <span className="flex items-center">
                            <Image
                              alt="Flight Booking Subagent"
                              className="size-[23px] rounded-full object-cover"
                              height={256}
                              width={256}
                              src="/landing/avatar-3.17c_x21xbh076.jpg"
                            />
                            <span className="ml-[10px]">
                              <span className="block text-[11.75px] leading-[15px] text-foreground/80 font-medium">
                                Flight Booking Leaf
                              </span>
                              <span className="block text-[10.5px] leading-[13px] text-muted-foreground">
                                leaf_flight_44
                              </span>
                            </span>
                          </span>
                          <span className="text-[11.5px] text-foreground/80">
                            SFO to JFK ₹3,200
                          </span>
                          <span className="flex items-center gap-[6px] text-[11.5px] text-foreground/80">
                            <Paperclip className="size-[13px] text-muted-foreground/70" />
                            receipt_paypal.pdf
                          </span>
                          <span className="text-[11.5px] text-foreground/80">
                            12 Nov 2026
                          </span>
                          <span className="flex items-center text-[11.5px] text-blue-400 font-semibold">
                            <span className="w-[62px] whitespace-nowrap">
                              Settled
                            </span>
                            <ChevronRight className="size-[13px] text-muted-foreground/70" />
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

        {/* Centered Floating Prompt Input Box with Typewriter Animation */}
        <div
          id="ask-agent"
          className="absolute bottom-[16px] sm:bottom-[28px] md:bottom-[34px] inset-x-0 flex justify-center z-30 pointer-events-none scroll-mt-24"
        >
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="w-[calc(100%-24px)] max-w-[620px] pointer-events-auto"
          >
            <HeroPromptComposer />
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}
