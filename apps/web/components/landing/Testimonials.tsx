"use client";

import React from "react";
import Image from "next/image";
import { motion } from "framer-motion";

interface Testimonial {
  quote: string;
  name: string;
  role: string;
  avatar: string;
  featured?: boolean;
}

const testimonials: Testimonial[] = [
  {
    quote:
      "Honestly I had no idea how we could let our booking agents spend without giving them our company card. With PayGuardian every agent gets a strict bounded budget. It's the first time autonomous commerce feels safe.",
    name: "Jordan Hale",
    role: "Founder & CEO of Northwind",
    avatar: "/landing/avatar-1.3c9mk9c-13we-.jpg",
    featured: true,
  },
  {
    quote:
      "What I love most about PayGuardian is the delegation hierarchy. Our Personal Agent hands off budgets to specialized subagents, and parent balances automatically deduct. Zero chance of overspending.",
    name: "Priya Nair",
    role: "Head of AI Platform, Fieldnote",
    avatar: "/landing/team-1.06us1yehp2dca.png",
  },
  {
    quote:
      "We were debating whether to build our own gateway or risk sharing raw API credentials. PayGuardian gave us cryptographic mandates, parent-child delegation, and instant kill switches out of the box.",
    name: "Marcus Lee",
    role: "Founder & CEO @ Parrot",
    avatar: "/landing/avatar-2.0787u8pfq-vwp.jpg",
  },
  {
    quote:
      "I love the clarity. The double-entry budget ledger is thought through down to the fine details, and makes audit reviews with finance effortless.",
    name: "Elena Fischer",
    role: "FinOps Lead, Lirion",
    avatar: "/landing/team-2.1qqvt1o53gd-q.png",
  },
  {
    quote:
      "PayGuardian is the first gateway that actually eliminated financial risk for our subagent chains instead of adding bureaucracy. Setting up the Fastify API took 10 minutes.",
    name: "Kabir Mehta",
    role: "CTO @ Bitstack",
    avatar: "/landing/avatar-3.17c_x21xbh076.jpg",
  },
  {
    quote:
      "Autonomous agent spending sounded like a huge compliance risk until PayGuardian. Now we have signed mandates and hard limits for every task.",
    name: "Camille Roux",
    role: "Growth & AI Lead, Orbital",
    avatar: "/landing/team-3.15m4ge8sx7lf0.png",
  },
  {
    quote:
      "Cascade revocation is PayGuardian's killer feature. If a subagent enters a retry loop or exceeds limits, we can revoke its entire subtree in one millisecond without touching root sessions.",
    name: "Ben Lawson",
    role: "Founder of Blynt AI",
    avatar: "/landing/avatar-4.29tix0ql09qoa.jpg",
    featured: true,
  },
  {
    quote:
      "PayGuardian is one of the most critical security layers in our stack. It gives our entire team a shared view of who authorized what and how much was spent.",
    name: "Sara Okafor",
    role: "Co-founder of Stockline",
    avatar: "/landing/team-4.38973p6om32mu.png",
  },
  {
    quote:
      "PayGuardian streamlines agent governance. It tracks allocations, flags anomalies, and settles PayPal Sandbox transactions without credential sharing.",
    name: "Adam Novak",
    role: "Partner at Roosh Ventures",
    avatar: "/landing/avatar-5.3mbtk5i8sfgi2.jpg",
  },
  {
    quote:
      "I was skeptical about AI spending authority until I tested PayGuardian. The authority checks are deterministic and never rely on LLM promises.",
    name: "Dev Gupta",
    role: "Co-founder of Talos Agents",
    avatar: "/landing/team-5.2l39mmlozxf13.png",
  },
  {
    quote:
      "Setup took ten minutes and the tamper-proof audit trail got approved by our security compliance team on day one.",
    name: "Lena Brandt",
    role: "Security Lead, Kite",
    avatar: "/landing/team-6.2h7dun3vhc8r2.png",
  },
];

export function Testimonials() {
  return (
    <section className="bg-background px-4 py-[64px] md:py-[80px]">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.5 }}
        className="text-center"
      >
        <h2 className="text-[30px] leading-[36px] font-semibold tracking-[-0.012em] text-foreground md:text-[42px] md:leading-[48px]">
          Predicting future comments
          <br className="max-md:hidden" /> of peoples building AI autonomous AI
        </h2>
        <p className="mt-[16px] text-[13.6px] leading-[24px] text-muted-foreground">
          Engineering, FinOps, and product teams use PayGuardian to bound spending,
          <br className="max-md:hidden" /> enforce cryptographic mandates, and govern agent
          commerce.
        </p>
      </motion.div>

      {/* Masonry Columns */}
      <div className="mx-auto mt-[40px] max-w-[1204px] gap-[16px] sm:columns-2 lg:columns-3">
        {testimonials.map((t, idx) => {
          return (
            <motion.figure
              key={idx}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-30px" }}
              transition={{ duration: 0.5, delay: (idx % 3) * 0.1 }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className={`mb-[16px] break-inside-avoid rounded-[16px] px-[23px] pt-[22px] pb-[24px] transition-shadow duration-200 ${
                t.featured
                  ? "bg-primary text-primary-foreground shadow-lg shadow-black/10"
                  : "border border-border bg-muted/80 hover:border-border/80 hover:shadow-md"
              }`}
            >
              <blockquote
                className={
                  t.featured
                    ? "text-[20px] leading-[30px] font-medium tracking-[-0.01em] text-primary-foreground md:text-[22px] md:leading-[32px]"
                    : "text-[14.5px] leading-[24.5px] text-foreground/80"
                }
              >
                {t.quote}
              </blockquote>
              <figcaption className="mt-[20px] flex items-center gap-[11px]">
                <img
                  alt={t.name}
                  className="size-[40px] rounded-full object-cover ring-1 ring-border"
                  height={40}
                  src={t.avatar}
                  width={40}
                />
                <span>
                  <span
                    className={`block text-[14px] font-semibold ${
                      t.featured ? "text-primary-foreground" : "text-foreground"
                    }`}
                  >
                    {t.name}
                  </span>
                  <span
                    className={`block text-[12.5px] ${
                      t.featured ? "text-primary-foreground/70" : "text-muted-foreground"
                    }`}
                  >
                    {t.role}
                  </span>
                </span>
              </figcaption>
            </motion.figure>
          );
        })}
      </div>
    </section>
  );
}
