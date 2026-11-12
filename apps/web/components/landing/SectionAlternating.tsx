"use client";

import React from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { CheckSquare, CornerDownRight } from "lucide-react";

export function SectionAlternating() {
  return (
    <section className="relative overflow-hidden bg-background px-4 pt-[64px] pb-[57px] text-center md:pt-[87px]">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.5 }}
      >
        <h2 className="text-[30px] leading-[36px] font-semibold tracking-[-0.012em] text-foreground md:text-[42px] md:leading-[48px]">
          Track every delegation,
          <br className="max-md:hidden" /> then enforce policies first
        </h2>
        <p className="mt-[17px] text-[13.6px] leading-[24px] text-muted-foreground">
          Observe delegation chains and authority grants across every agent, and let the gateway
          <br className="max-md:hidden" /> enforce strict mathematical headroom before any transaction settles.
        </p>
      </motion.div>

      <div className="mx-auto mt-[56px] mb-[56px] grid max-w-[1204px] gap-[72px] text-left max-lg:max-w-[560px] lg:gap-[112px]">
        {/* Row 1: Approve transactions in milliseconds */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.6 }}
          className="grid items-center gap-[32px] lg:grid-cols-[1fr_1.15fr] lg:gap-[72px]"
        >
          <div>
            <h3 className="text-[24px] leading-[30px] font-semibold tracking-[-0.015em] text-muted-foreground/70 md:text-[30px] md:leading-[36px]">
              <span className="text-foreground">Approve</span> transactions in milliseconds
            </h3>
            <p className="mt-[14px] max-w-[460px] text-[14.5px] leading-[23px] text-muted-foreground">
              Ask for an authorization and the gateway validates it against parent headroom and live policies, then issues a cryptographic signature.
            </p>
            <ul className="mt-[22px] space-y-[11px] text-[14.5px] leading-[22px] text-foreground/80">
              <li className="flex gap-[10px]">
                <CheckSquare className="mt-[1px] size-[18px] shrink-0 fill-[#1f8a4c] text-primary-foreground stroke-[2.2]" />
                <span>Mandates signed with asymmetric keys</span>
              </li>
              <li className="flex gap-[10px]">
                <CheckSquare className="mt-[1px] size-[18px] shrink-0 fill-[#1f8a4c] text-primary-foreground stroke-[2.2]" />
                <span>Automatic parent budget reservation</span>
              </li>
              <li className="flex gap-[10px]">
                <CheckSquare className="mt-[1px] size-[18px] shrink-0 fill-[#1f8a4c] text-primary-foreground stroke-[2.2]" />
                <span>Instant single-click approval or denial</span>
              </li>
            </ul>
          </div>

          {/* Interactive Chat & Mandate Card */}
          <div
            className="relative @container"
            style={
              {
                "--fit-w": 520,
                "--fit-h": 300,
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
              <span className="absolute -top-[40px] left-[120px] h-[200px] w-[300px] rounded-full bg-[#dbe6ff]/35 blur-[70px] dark:bg-[#1e2a4a]/20" />
              <div aria-hidden={true} className="pointer-events-none relative size-full select-none">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-full max-w-[360px] space-y-4">
                    <div className="flex justify-end">
                      <div className="max-w-[85%] rounded-l-xl rounded-tr-xl rounded-br-sm bg-secondary px-3.5 py-2.5 text-[14px] leading-5 text-foreground shadow-sm ring-1 ring-black/5 dark:ring-white/5">
                        authorize flight booking for travel agent up to $250
                      </div>
                    </div>
                    <p className="text-[14px] leading-5 text-foreground">
                      Mandate drafted.
                      <br />
                      Verify parameters before signing:
                    </p>
                    <div className="max-w-[90%] px-3.5 py-2.5 rounded-xl border border-border bg-card shadow-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[12px] text-muted-foreground">Travel Specialist Mandate</span>
                        <div className="flex items-center -space-x-1.5">
                          <img
                            alt=""
                            className="size-5 rounded-full object-cover ring-2 ring-card"
                            height="256"
                            src="/landing/avatar-2.0787u8pfq-vwp.jpg"
                            width="256"
                          />
                          <img
                            alt=""
                            className="size-5 rounded-full object-cover ring-2 ring-card"
                            height="256"
                            src="/landing/avatar-3.17c_x21xbh076.jpg"
                            width="256"
                          />
                          <img
                            alt=""
                            className="size-5 rounded-full object-cover ring-2 ring-card"
                            height="256"
                            src="/landing/avatar-4.29tix0ql09qoa.jpg"
                            width="256"
                          />
                          <span className="flex size-5 items-center justify-center rounded-full bg-secondary text-[9px] font-medium ring-2 ring-card text-muted-foreground">
                            +2
                          </span>
                        </div>
                      </div>
                      <p className="mt-1 truncate text-[14px] leading-snug font-semibold text-foreground">
                        Flight SFO &rarr; JFK ($250 Cap)
                      </p>
                      <p className="mt-0.5 truncate text-[12px] leading-snug text-muted-foreground">
                        Parent: Personal Root ($2,000 available)...
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <span className="text-[12px] font-medium text-muted-foreground">Enforcement status</span>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <CornerDownRight className="size-3.5 shrink-0" />
                        <span className="text-[14px] font-medium text-emerald-500">
                          Mandate active & reserved
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Row 2: Govern what requires human approval */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.6 }}
          className="grid items-center gap-[32px] lg:grid-cols-[1fr_1.15fr] lg:gap-[72px]"
        >
          <div className="lg:order-last">
            <h3 className="text-[24px] leading-[30px] font-semibold tracking-[-0.015em] text-muted-foreground/70 md:text-[30px] md:leading-[36px]">
              <span className="text-foreground">Govern</span> what requires human approval
            </h3>
            <p className="mt-[14px] max-w-[460px] text-[14.5px] leading-[23px] text-muted-foreground">
              Ask what needs review and get high-risk delegations ranked by spending tier, threshold alerts, and compliance impact.
            </p>
            <ul className="mt-[22px] space-y-[11px] text-[14.5px] leading-[22px] text-foreground/80">
              <li className="flex gap-[10px]">
                <CheckSquare className="mt-[1px] size-[18px] shrink-0 fill-[#1f8a4c] text-primary-foreground stroke-[2.2]" />
                <span>Policy-triggered approvals for high-value orders</span>
              </li>
              <li className="flex gap-[10px]">
                <CheckSquare className="mt-[1px] size-[18px] shrink-0 fill-[#1f8a4c] text-primary-foreground stroke-[2.2]" />
                <span>Due dates and auto-revocation triggers</span>
              </li>
              <li className="flex gap-[10px]">
                <CheckSquare className="mt-[1px] size-[18px] shrink-0 fill-[#1f8a4c] text-primary-foreground stroke-[2.2]" />
                <span>Shared across finance and security teams</span>
              </li>
            </ul>
          </div>

          {/* Interactive Chat & Spending Limits Card */}
          <div
            className="relative @container"
            style={
              {
                "--fit-w": 520,
                "--fit-h": 300,
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
              <span className="absolute -top-[40px] left-[120px] h-[200px] w-[300px] rounded-full bg-[#dbe6ff]/35 blur-[70px] dark:bg-[#1e2a4a]/20" />
              <div aria-hidden={true} className="pointer-events-none relative size-full select-none">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-full max-w-[360px] space-y-4">
                    <div className="flex justify-end">
                      <div className="max-w-[85%] rounded-l-xl rounded-tr-xl rounded-br-sm bg-secondary px-3.5 py-2.5 text-[14px] leading-5 text-foreground shadow-sm ring-1 ring-black/5 dark:ring-white/5">
                        What are the active agent spending limits this week?
                      </div>
                    </div>
                    <p className="text-[14px] leading-5 text-foreground">
                      Here are 2 active budget allocations:
                    </p>
                    <div className="max-w-[85%] space-y-2">
                      <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-border bg-card shadow-sm">
                        <span className="size-4 shrink-0 rounded-full border border-black/30 dark:border-white/30" />
                        <p className="flex-1 truncate text-[14px] leading-5 font-semibold text-foreground">
                          Travel & Hospitality Agent ($250 remaining)
                        </p>
                        <span className="shrink-0 text-[12px] font-medium text-amber-500">Active</span>
                      </div>
                      <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-border bg-card shadow-sm">
                        <span className="size-4 shrink-0 rounded-full border border-black/30 dark:border-white/30" />
                        <p className="flex-1 truncate text-[14px] leading-5 font-semibold text-foreground">
                          E-Commerce Agent ($120 remaining)
                        </p>
                        <span className="shrink-0 text-[12px] font-medium text-muted-foreground/70">Review</span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <span className="text-[12px] font-medium text-muted-foreground">Enforcement status</span>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <CornerDownRight className="size-3.5 shrink-0" />
                        <span className="text-[14px] font-medium">Adjust Travel allocation cap</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
