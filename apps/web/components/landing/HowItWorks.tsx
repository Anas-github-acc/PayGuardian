"use client";

import React from "react";
import { motion } from "framer-motion";

export function HowItWorks() {
  return (
    <section className="bg-background px-4 pt-[16px] pb-[64px] md:pb-[95px]" id="gateway">
      <div className="mx-auto grid max-w-[1204px] gap-[20px] text-left max-lg:max-w-[600px] lg:grid-cols-3">
        {/* Card 1: Wide Card */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.6 }}
          whileHover={{ y: -3 }}
          className="overflow-hidden rounded-[20px] border border-border bg-card lg:col-span-2 lg:flex lg:flex-row-reverse transition-transform duration-200"
        >
          <div
            aria-hidden={true}
            className="pointer-events-none relative select-none overflow-hidden h-[300px] lg:h-auto lg:flex-1"
          >
            <div className="absolute top-[32px] right-0 bottom-0 left-[24px] rounded-tl-[16px] border-r-0 border-b-0 lg:top-[44px] lg:left-0 bg-background border border-border">
              <div className="flex items-center gap-[20px] border-b border-border px-[22px] py-[15px] text-muted-foreground">
                <svg
                  aria-hidden={true}
                  className="lucide lucide-chevron-left size-[17px]"
                  fill="none"
                  height="24"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  width="24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="m15 18-6-6 6-6"></path>
                </svg>
                <svg
                  aria-hidden={true}
                  className="lucide lucide-archive size-[17px]"
                  fill="none"
                  height="24"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  width="24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <rect height="5" rx="1" width="20" x="2" y="3"></rect>
                  <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"></path>
                  <path d="M10 12h4"></path>
                </svg>
                <svg
                  aria-hidden={true}
                  className="lucide lucide-mail-plus size-[17px]"
                  fill="none"
                  height="24"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  width="24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h8"></path>
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>
                  <path d="M19 16v6"></path>
                  <path d="M16 19h6"></path>
                </svg>
                <svg
                  aria-hidden={true}
                  className="lucide lucide-clock size-[17px]"
                  fill="none"
                  height="24"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  width="24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle cx="12" cy="12" r="10"></circle>
                  <path d="M12 6v6l4 2"></path>
                </svg>
                <svg
                  aria-hidden={true}
                  className="lucide lucide-trash lucide-trash-2 size-[17px]"
                  fill="none"
                  height="24"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  width="24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M10 11v6"></path>
                  <path d="M14 11v6"></path>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path>
                  <path d="M3 6h18"></path>
                  <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
                <svg
                  aria-hidden={true}
                  className="lucide lucide-ellipsis lucide-more-horizontal size-[17px]"
                  fill="none"
                  height="24"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  width="24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle cx="12" cy="12" r="1"></circle>
                  <circle cx="19" cy="12" r="1"></circle>
                  <circle cx="5" cy="12" r="1"></circle>
                </svg>
                <span className="ml-auto flex -space-x-[8px]">
                  <img
                    alt=""
                    className="size-[26px] rounded-[7px] object-cover ring-2 ring-background"
                    height="256"
                    src="/landing/avatar-1.3c9mk9c-13we-.jpg"
                    width="256"
                  />
                  <img
                    alt=""
                    className="size-[26px] rounded-[7px] object-cover ring-2 ring-background"
                    height="256"
                    src="/landing/avatar-2.0787u8pfq-vwp.jpg"
                    width="256"
                  />
                </span>
              </div>
              <div className="px-[22px] pt-[18px]">
                <p className="flex items-center gap-[10px] text-[15px] font-semibold whitespace-nowrap text-foreground md:text-[17px]">
                  Flight Booking Mandate — Travel Subagent
                  <span className="rounded-[6px] bg-[#e8f6ec] dark:bg-[#16301f] px-[8px] py-[3px] text-[12px] font-medium text-[#2f8a4c] dark:text-[#6fd08f]">
                    Needs Approval
                  </span>
                </p>
                <div className="mt-[14px] flex gap-[12px]">
                  <img
                    alt=""
                    className="size-[34px] shrink-0 rounded-[8px] object-cover"
                    height="256"
                    src="/landing/avatar-3.17c_x21xbh076.jpg"
                    width="256"
                  />
                  <div className="max-w-[440px] text-[13.5px] leading-[21px] text-foreground/80">
                    <p>
                      <b className="font-semibold text-foreground">Henrik Olsen</b>{" "}
                      <span className="text-muted-foreground/70">Wednesday at 6:26 PM</span>
                    </p>
                    <p className="mt-[3px]">
                      Requested spending authorization for flight booking SFO &rarr; JFK. Total
                      estimated: $450.00.
                    </p>
                    <p className="mt-[10px]">
                      Parent mandate has headroom ($1,500 available). Attached mandate request.
                    </p>
                    <span className="mt-[12px] inline-flex items-center gap-[8px] rounded-[8px] border border-border bg-muted py-[6px] pr-[12px] pl-[8px]">
                      <span className="grid size-[24px] place-items-center rounded-[5px] bg-[#fdecec] dark:bg-[#3a1717] text-[#d64545]">
                        <svg
                          aria-hidden={true}
                          className="lucide lucide-file-text size-[13px]"
                          fill="none"
                          height="24"
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                          width="24"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"></path>
                          <path d="M14 2v5a1 1 0 0 0 1 1h5"></path>
                          <path d="M10 9H8"></path>
                          <path d="M16 13H8"></path>
                          <path d="M16 17H8"></path>
                        </svg>
                      </span>
                      <span className="text-[12.5px] font-medium text-foreground">
                        Mandate_Request_450.sig
                      </span>
                      <span className="text-[11.5px] text-muted-foreground/70">248 KB</span>
                    </span>
                  </div>
                </div>
                <div className="mt-[18px] ml-[46px] rounded-[12px] border border-[#dfe7fb] dark:border-[#24314f] bg-[#f5f8ff] dark:bg-[#111827] px-[14px] pt-[12px] pb-[14px]">
                  <p className="flex items-center gap-[6px] text-[12px] font-medium text-[#3b6fe0] dark:text-[#7da2ff]">
                    <svg
                      aria-hidden={true}
                      className="lucide lucide-sparkles lucide-stars size-[13px]"
                      fill="none"
                      height="24"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                      width="24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"></path>
                      <path d="M20 2v4"></path>
                      <path d="M22 4h-4"></path>
                      <circle cx="4" cy="20" r="2"></circle>
                    </svg>
                    PayGuardian Gateway Policy Verified
                  </p>
                  <p className="mt-[6px] max-w-[440px] text-[13.5px] leading-[21px] text-foreground/80">
                    Mandate parameters conform to Travel policy limits. Cryptographic signature
                    ready to commit.
                  </p>
                  <div className="mt-[12px] flex gap-[8px] text-[12px] font-medium">
                    <span className="inline-flex h-[28px] items-center gap-[6px] rounded-[7px] bg-primary px-[12px] text-primary-foreground">
                      Approve Mandate
                      <svg
                        aria-hidden={true}
                        className="lucide lucide-send-horizontal lucide-send-horizonal size-[12px]"
                        fill="none"
                        height="24"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                        width="24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path d="M3.714 3.048a.498.498 0 0 0-.683.627l2.843 7.627a2 2 0 0 1 0 1.396l-2.842 7.627a.498.498 0 0 0 .682.627l18-8.5a.5.5 0 0 0 0-.904z"></path>
                        <path d="M6 12h16"></path>
                      </svg>
                    </span>
                    <span className="inline-flex h-[28px] items-center rounded-[7px] border border-border px-[12px] text-foreground/80">
                      Adjust Limit
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <span className="absolute inset-x-0 bottom-0 h-[56px] bg-gradient-to-t from-card"></span>
          </div>
          <div className="px-[24px] pt-[8px] pb-[36px] md:px-[32px] lg:flex lg:w-[38%] lg:shrink-0 lg:flex-col lg:justify-end">
            <h3 className="text-[18px] leading-[24px] font-semibold text-foreground">
              Mandates enforced with full context
            </h3>
            <p className="mt-[14px] text-[14.5px] leading-[23px] text-muted-foreground">
              The gateway verifies parent budget headroom, expiration timestamps, and policy
              constraints before approving any transaction.
            </p>
          </div>
        </motion.div>

        {/* Card 2: Tall Card */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.6, delay: 0.15 }}
          whileHover={{ y: -3 }}
          className="overflow-hidden rounded-[20px] border border-border bg-card transition-transform duration-200"
        >
          <div
            aria-hidden={true}
            className="pointer-events-none relative select-none overflow-hidden h-[260px]"
          >
            <div className="absolute inset-0 flex items-center justify-center px-3 pt-6 pb-2 sm:px-8">
              <svg
                aria-hidden={true}
                className="absolute inset-0 size-full text-[#e5e5e5] opacity-60 dark:text-[#333] dark:opacity-60"
              >
                <defs>
                  <pattern
                    height="10"
                    id="workflow-timeline-dots"
                    patternUnits="userSpaceOnUse"
                    width="10"
                  >
                    <rect fill="currentColor" height="1" width="1" x="4.5" y="4.5"></rect>
                  </pattern>
                </defs>
                <rect fill="url(#workflow-timeline-dots)" height="100%" width="100%"></rect>
              </svg>
              <div className="relative w-full max-w-[316px] pl-12">
                <div className="absolute top-0 bottom-0 left-6 border-l border-dashed border-black/15 dark:border-white/15"></div>
                <div className="relative">
                  <div className="absolute top-0 -left-9 z-10 flex size-6 items-center justify-center rounded-md bg-blue-100 text-blue-600 ring-1 ring-blue-200/60 dark:bg-blue-950/40 dark:text-blue-400 dark:ring-blue-900/40">
                    <svg
                      aria-hidden={true}
                      className="lucide lucide-calendar size-3"
                      fill="none"
                      height="24"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2.5"
                      viewBox="0 0 24 24"
                      width="24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path d="M8 2v3"></path>
                      <path d="M16 2v3"></path>
                      <rect height="18" rx="2" width="18" x="3" y="3"></rect>
                      <path d="M3 9h18"></path>
                    </svg>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 pl-1 text-[11px]">
                      <img
                        alt=""
                        className="size-4 shrink-0 rounded-full object-cover"
                        height="256"
                        src="/landing/avatar-2.0787u8pfq-vwp.jpg"
                        width="256"
                      />
                      <span className="min-w-0 truncate text-muted-foreground">
                        <span className="font-semibold text-foreground">Personal Root Agent</span>{" "}
                        delegated budget to Travel Agent
                      </span>
                      <span className="ml-auto shrink-0 text-[10px] whitespace-nowrap text-muted-foreground/70">
                        1h ago
                      </span>
                    </div>
                    <div className="ml-1 rounded-md p-2.5 shadow-sm bg-background border border-border">
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-0.5 rounded-md bg-emerald-100 px-1.5 py-px text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                          <svg
                            aria-hidden={true}
                            className="lucide lucide-badge-check lucide-verified size-2.5"
                            fill="none"
                            height="24"
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="3"
                            viewBox="0 0 24 24"
                            width="24"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"></path>
                            <path d="m16 9-5.5 5.5L8 12"></path>
                          </svg>
                          Approved
                        </span>
                        <div className="flex -space-x-1">
                          <span className="flex size-4 items-center justify-center rounded-full bg-blue-500 text-[8px] font-bold text-white ring-2 ring-background">
                            H
                          </span>
                          <span className="flex size-4 items-center justify-center rounded-full bg-amber-500 text-[8px] font-bold text-white ring-2 ring-background">
                            A
                          </span>
                        </div>
                      </div>
                      <p className="mt-1.5 text-[11px] leading-snug font-semibold text-foreground">
                        Travel & Lodging Mandate — Hotel Allocation
                      </p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        Limit: ₹10,000 · Expires in 72h
                      </p>
                    </div>
                  </div>
                </div>
                <div className="h-3"></div>
                <div className="relative">
                  <div className="absolute top-0 -left-9 z-10 flex size-6 items-center justify-center rounded-md bg-blue-100 text-blue-600 ring-1 ring-blue-200/60 dark:bg-blue-950/40 dark:text-blue-400 dark:ring-blue-900/40">
                    <svg
                      aria-hidden={true}
                      className="lucide lucide-copy size-3"
                      fill="none"
                      height="24"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2.5"
                      viewBox="0 0 24 24"
                      width="24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <rect height="14" rx="2" ry="2" width="14" x="8" y="8"></rect>
                      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path>
                    </svg>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 pl-1 text-[11px]">
                      <img
                        alt=""
                        className="size-4 shrink-0 rounded-full object-cover"
                        height="256"
                        src="/landing/avatar-4.29tix0ql09qoa.jpg"
                        width="256"
                      />
                      <span className="inline-flex min-w-0 items-center gap-[3px] truncate text-muted-foreground">
                        <span className="shrink-0 font-semibold text-foreground">
                          Flight Specialist Subagent
                        </span>
                        <span className="shrink-0">settled PayPal booking ₹3,200</span>
                      </span>
                      <span className="ml-auto shrink-0 text-[10px] whitespace-nowrap text-muted-foreground/70">
                        5h ago
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="px-[24px] pt-[8px] pb-[36px] md:px-[32px]">
            <h3 className="text-[18px] leading-[24px] font-semibold text-foreground">
              Your whole agent tree, one audit timeline
            </h3>
            <p className="mt-[14px] text-[14.5px] leading-[23px] text-muted-foreground xl:whitespace-pre-line">
              Keep Personal agents, specialist subagents, and human approvers in sync as mandates
              execute, budgets debit, and ledger entries confirm.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
