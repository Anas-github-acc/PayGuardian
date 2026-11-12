"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";

interface FAQItem {
  q: string;
  a: string;
}

const faqs: FAQItem[] = [
  {
    q: "How does PayGuardian prevent agents from overspending?",
    a: "PayGuardian enforces a deterministic double-entry ledger gateway. Every child agent allocation is strictly carved out of its parent's approved budget. When a child agent attempts an action, the gateway checks real-time headroom and reserves the funds before triggering payment. If the total requested amount exceeds available allocation, the transaction is rejected instantly.",
  },
  {
    q: "What is an Agent Mandate and how does delegation work?",
    a: "A Mandate is a cryptographically signed, bounded grant of authority. It specifies the environment, holder agent, budget ceiling, allowed spending categories (e.g. travel, dining), and expiration window. When a Personal Agent delegates work to a Travel Agent, it signs a child mandate whose funds are debited from the parent. No raw API keys or payment credentials are ever passed down.",
  },
  {
    q: "Which payment rails and providers does PayGuardian support?",
    a: "PayGuardian supports PayPal Sandbox and production APIs for card and wallet payments with durable worker leases, retry mechanisms, and automated reconciliation. External providers, simulated bank rails (e.g. INR/USD), and additional merchant gateways can be connected via our modular provider boundary.",
  },
  {
    q: "Can a subagent spend more than its parent approved?",
    a: "No. The gateway enforces mathematical and cryptographic invariants: the sum of all child allocations and expenditures can never exceed the parent mandate's total available balance. Privilege escalation or budget inflation is prevented at the gateway level regardless of the agent's LLM reasoning.",
  },
  {
    q: "How does instant cascade revocation work?",
    a: "If an agent is compromised or enters an uncontrolled loop, revoking its mandate instantly and recursively revokes every child, grandchild, and descendant mandate down the delegation tree. Any pending reservations are released back to the parent allocation immediately.",
  },
  {
    q: "Does PayGuardian support Model Context Protocol (MCP)?",
    a: "Yes! PayGuardian exposes a native Model Context Protocol (MCP) server interface. Claude Desktop, Cursor, and any MCP-compatible client can query balances, request delegation headroom, and inspect approval statuses as first-class tools.",
  },
  {
    q: "How are credentials protected between agents?",
    a: "PayGuardian completely eliminates credential sharing. Subagents never receive user credit cards, bank tokens, or master PayPal credentials. Instead, subagents receive bounded delegation tokens that can only execute pre-authorized actions within policy parameters.",
  },
  {
    q: "Can I integrate PayGuardian with Python ADK or LangChain?",
    a: "Yes. PayGuardian includes an ADK-compatible agent runtime for Python, complete with client libraries and pre-configured dummy agents (Personal, Travel, Hotel, Transport, Food, Activities). You can plug PayGuardian into LangChain, AutoGen, CrewAI, or custom agent frameworks via our REST API.",
  },
  {
    q: "Is the audit trail tamper-proof?",
    a: "Yes. Every mandate issuance, delegation step, reservation, approval, denial, and settlement is recorded in an immutable ledger with SHA-256 cryptographic hashes and full actor provenance, providing enterprise-grade compliance.",
  },
  {
    q: "Is PayGuardian completely free to use?",
    a: "Yes. PayGuardian is 100% free and open-source during our public beta. You have unlimited access to all features, multi-agent trees, environments, and API integrations with zero credit card required.",
  },
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="bg-background px-4 pt-[56px] pb-[96px]" id="faq">
      <div className="mx-auto grid max-w-[1204px] gap-[48px] lg:grid-cols-[1fr_1.6fr]">
        {/* Left header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-[30px] leading-[36px] font-semibold tracking-[-0.012em] text-foreground md:text-[42px] md:leading-[48px]">
            Frequently asked
            <br />
            questions
          </h2>
          <p className="mt-[16px] text-[14px] text-muted-foreground">
            Still have a question in mind?{" "}
            <Link
              className="underline underline-offset-4 text-foreground/90 transition-colors hover:text-foreground font-medium"
              href="#contact"
            >
              Contact us
            </Link>
          </p>
        </motion.div>

        {/* Right accordion list: subtle soft borders, no dark white lines */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="space-y-[6px]"
        >
          {faqs.map((item, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={idx}
                className={`rounded-[14px] px-[18px] py-[16px] transition-colors duration-200 ${
                  isOpen
                    ? "bg-white/[0.03]"
                    : "hover:bg-white/[0.015]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  className="flex w-full cursor-pointer list-none items-center justify-between text-left text-[15.5px] font-semibold text-foreground/90 transition-colors hover:text-foreground"
                >
                  <span className="pr-4 leading-snug">{item.q}</span>
                  <motion.span
                    animate={{ rotate: isOpen ? 45 : 0 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    className="grid size-[28px] shrink-0 place-items-center rounded-full bg-white/[0.06] text-foreground/80"
                  >
                    <Plus className="size-[14px]" />
                  </motion.span>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      key="answer"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{
                        height: "auto",
                        opacity: 1,
                        transition: {
                          height: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
                          opacity: { duration: 0.25, delay: 0.05 },
                        },
                      }}
                      exit={{
                        height: 0,
                        opacity: 0,
                        transition: {
                          height: { duration: 0.25, ease: [0.16, 1, 0.3, 1] },
                          opacity: { duration: 0.15 },
                        },
                      }}
                      className="overflow-hidden"
                    >
                      <p className="mt-[12px] text-[14px] leading-[23px] text-muted-foreground/90">
                        {item.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
