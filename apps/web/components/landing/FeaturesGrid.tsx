"use client";

import React from "react";
import { motion } from "framer-motion";
import { MessageSquare, Compass, Shield, ChevronDown } from "lucide-react";
import { Section2BackgroundSvg } from "./BackgroundSvgs";

export function FeaturesGrid() {
  return (
    <section className="relative overflow-hidden bg-background px-4 pt-[72px] pb-[52.5px] md:pt-[108px]" id="features">
      <Section2BackgroundSvg />
      
      {/* Heading */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.5 }}
        className="relative text-center"
      >
        <h2 className="text-[30px] leading-[36px] font-semibold tracking-[-0.012em] text-foreground md:text-[42px] md:leading-[48px]">
          Everything you need to
          <br className="max-md:hidden"/>
          govern agent spending
        </h2>
        <p className="mt-[16.5px] text-[13.6px] leading-[25px] text-foreground/80">
          One gateway that enforces bounded authority, works inside the tools you already use,
          <br className="max-md:hidden"/>
          and shows you exactly which child agents reserve, allocate, and spend.
        </p>
      </motion.div>

      {/* 3 Grid Cards */}
      <div className="relative mx-auto mt-[41.5px] grid max-w-[1204px] gap-x-[14px] gap-y-[40px] max-lg:max-w-[480px] lg:grid-cols-3">
        {/* Card 1 */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.5, delay: 0.1 }}
          whileHover={{ y: -4 }}
          className="transition-transform duration-200"
        >
          <div className="relative @container" style={{"--fit-w": 392, "--fit-h": 255, aspectRatio: "var(--fit-w) / var(--fit-h)"} as React.CSSProperties}>
            <div className="absolute top-0 left-0 origin-top-left" style={{"width": "calc(var(--fit-w) * 1px)", "height": "calc(var(--fit-h) * 1px)", scale: "tan(atan2(100cqw, var(--fit-w) * 1px))"} as React.CSSProperties}>
              <div aria-hidden={true} className="relative h-[255px] overflow-hidden rounded-[18px] border border-border bg-muted select-none">
                <div className="absolute top-[100px] left-[86px] h-[111px] w-[320px] rounded-[14px] bg-background shadow-[0_4px_14px_rgba(0,0,0,0.04)] [mask-image:linear-gradient(90deg,#000_65%,transparent)]">
                  <div className="absolute bottom-[12px] left-[11px] flex items-center">
                    <span className="grid size-[27px] place-items-center rounded-[7px] bg-primary">
                      <svg aria-hidden={true} className="lucide lucide-plus size-[14px] text-primary-foreground" fill="none" height="24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M5 12h14"></path>
                        <path d="M12 5v14"></path>
                      </svg>
                    </span>
                    <span className="ml-[10px] flex h-[27px] w-[88px] items-center justify-center gap-[6px] rounded-[7px] bg-muted text-[13px] font-medium text-foreground/90">
                      Delegate
                      <ChevronDown className="size-[12px] text-muted-foreground" />
                    </span>
                  </div>
                </div>
                <ul className="absolute top-[43.5px] left-[79.5px] w-[218px] rounded-[14px] bg-background p-[4px] text-left text-[13.9px] shadow-[0_6px_18px_rgba(0,0,0,0.07),0_1px_3px_rgba(0,0,0,0.04)]">
                  <li className="flex h-[32px] items-center gap-[11px] rounded-[9px] pl-[10px] [&+&]:mt-[4px] text-muted-foreground transition-colors hover:text-foreground">
                    <MessageSquare className="size-[15px] text-muted-foreground/70" />
                    Ask
                  </li>
                  <li className="flex h-[32px] items-center gap-[11px] rounded-[9px] pl-[10px] [&+&]:mt-[4px] text-muted-foreground transition-colors hover:text-foreground">
                    <Compass className="size-[15px] text-muted-foreground/70" />
                    Plan
                  </li>
                  <li className="flex h-[32px] items-center gap-[11px] rounded-[9px] pl-[10px] [&+&]:mt-[4px] bg-muted font-semibold text-foreground/90">
                    <Shield className="size-[15px] text-foreground/80" />
                    Delegate
                  </li>
                </ul>
                <svg className="absolute top-[110px] left-[261px] size-[22px] drop-shadow-[0_1px_1px_rgba(0,0,0,0.15)]" viewBox="0 0 18 18">
                  <path d="M1.5 1.5l14 5.2-6.3 2.5-2.5 6.3z" fill="#454545" stroke="#fff" strokeLinejoin="round" strokeWidth="1.2"></path>
                </svg>
              </div>
            </div>
          </div>
          <h3 className="mt-[18.5px] text-[18px] leading-[22px] font-semibold text-foreground">Ask the gateway anything</h3>
          <p className="mt-[10px] text-[13.6px] leading-[18px] text-foreground/80">Query agent budgets, active delegation trees, and pending approval mandates in real-time.</p>
        </motion.div>

        {/* Card 2 */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.5, delay: 0.2 }}
          whileHover={{ y: -4 }}
          className="transition-transform duration-200"
        >
          <div className="relative @container" style={{"--fit-w": 392, "--fit-h": 255, aspectRatio: "var(--fit-w) / var(--fit-h)"} as React.CSSProperties}>
            <div className="absolute top-0 left-0 origin-top-left" style={{"width": "calc(var(--fit-w) * 1px)", "height": "calc(var(--fit-h) * 1px)", scale: "tan(atan2(100cqw, var(--fit-w) * 1px))"} as React.CSSProperties}>
              <div aria-hidden={true} className="relative h-[255px] overflow-hidden rounded-[18px] border border-border bg-muted select-none">
                <span className="absolute grid size-[59px] place-items-center rounded-[14px] bg-background shadow-[0_2px_8px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.015)]" style={{top: "60px", left: "-12px"}}>
                  <img alt="" className="size-[30px] object-contain" height="512" src="/landing/google-calendar.3j79nwsv75n05.svg" width="512"/>
                </span>
                <span className="absolute grid size-[59px] place-items-center rounded-[14px] bg-background shadow-[0_2px_8px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.015)]" style={{top: "60px", left: "64px"}}>
                  <svg className="size-[31px]" fill="none" stroke="#5a4fd3" strokeLinecap="round" strokeWidth="2.6" viewBox="0 0 32 32">
                    <circle cx="16" cy="16" r="4.6"></circle>
                    <line transform="rotate(0 16 16)" x1="16" x2="16" y1="8" y2="2.5"></line>
                    <line transform="rotate(30 16 16)" x1="16" x2="16" y1="8" y2="2.5"></line>
                    <line transform="rotate(60 16 16)" x1="16" x2="16" y1="8" y2="2.5"></line>
                    <line transform="rotate(90 16 16)" x1="16" x2="16" y1="8" y2="2.5"></line>
                    <line transform="rotate(120 16 16)" x1="16" x2="16" y1="8" y2="2.5"></line>
                    <line transform="rotate(150 16 16)" x1="16" x2="16" y1="8" y2="2.5"></line>
                    <line transform="rotate(180 16 16)" x1="16" x2="16" y1="8" y2="2.5"></line>
                    <line transform="rotate(210 16 16)" x1="16" x2="16" y1="8" y2="2.5"></line>
                    <line transform="rotate(240 16 16)" x1="16" x2="16" y1="8" y2="2.5"></line>
                    <line transform="rotate(270 16 16)" x1="16" x2="16" y1="8" y2="2.5"></line>
                    <line transform="rotate(300 16 16)" x1="16" x2="16" y1="8" y2="2.5"></line>
                    <line transform="rotate(330 16 16)" x1="16" x2="16" y1="8" y2="2.5"></line>
                  </svg>
                </span>
                <span className="absolute grid size-[59px] place-items-center rounded-[14px] bg-background shadow-[0_2px_8px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.015)]" style={{top: "60px", left: "140px"}}>
                  <svg className="size-[31px]" viewBox="0 0 32 32">
                    <rect fill="#ec5c2e" height="28" rx="1" transform="rotate(0 16 16)" width="5.4" x="13.3" y="2"></rect>
                    <rect fill="#ec5c2e" height="28" rx="1" transform="rotate(45 16 16)" width="5.4" x="13.3" y="2"></rect>
                    <rect fill="#ec5c2e" height="28" rx="1" transform="rotate(90 16 16)" width="5.4" x="13.3" y="2"></rect>
                    <rect fill="#ec5c2e" height="28" rx="1" transform="rotate(135 16 16)" width="5.4" x="13.3" y="2"></rect>
                    <rect fill="#fff" height="6" width="6" x="13" y="13"></rect>
                  </svg>
                </span>
                <span className="absolute grid size-[59px] place-items-center rounded-[14px] bg-background shadow-[0_2px_8px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.015)]" style={{top: "60px", left: "216px"}}>
                  <img alt="" className="size-[30px] object-contain" height="512" src="/landing/google-meet.39xzyl7eopykb.svg" width="622"/>
                </span>
                <span className="absolute grid size-[59px] place-items-center rounded-[14px] bg-background shadow-[0_2px_8px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.015)]" style={{top: "60px", left: "292px"}}>
                  <img alt="" className="size-[30px] object-contain" height="64" src="/landing/clickup.096_f09wewze_.svg" width="64"/>
                </span>
                <span className="absolute grid size-[59px] place-items-center rounded-[14px] bg-background shadow-[0_2px_8px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.015)]" style={{top: "60px", left: "368px"}}>
                  <img alt="" className="size-[30px] object-contain" height="200" src="/landing/linear.3xpqc5i-u01rs.svg" width="200"/>
                </span>
                <span className="absolute grid size-[59px] place-items-center rounded-[14px] bg-background shadow-[0_2px_8px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.015)]" style={{top: "137px", left: "-45.3px"}}>
                  <img alt="" className="size-[30px] object-contain" height="268" src="/landing/notion.2ukonjt4ado3f.svg" width="256"/>
                </span>
                <span className="absolute grid size-[59px] place-items-center rounded-[14px] bg-background shadow-[0_2px_8px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.015)]" style={{top: "137px", left: "30.7px"}}>
                  <img alt="" className="size-[30px] object-contain" height="563" src="/landing/microsoft-powerpoint.07xb2_72o-q0r.svg" width="581"/>
                </span>
                <span className="absolute grid size-[59px] place-items-center rounded-[14px] bg-background shadow-[0_2px_8px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.015)]" style={{top: "137px", left: "106.7px"}}>
                  <img alt="" className="size-[30px] object-contain" height="2453" src="/landing/slack.3ivzp7dkus3ms.svg" width="2448"/>
                </span>
                <span className="absolute grid size-[59px] place-items-center rounded-[14px] bg-background shadow-[0_2px_8px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.015)]" style={{top: "137px", left: "182.7px"}}>
                  <img alt="" className="size-[30px] object-contain" height="399" src="/landing/gmail.014ry_xgtx2rm.svg" width="512"/>
                </span>
                <span className="absolute grid size-[59px] place-items-center rounded-[14px] bg-background shadow-[0_2px_8px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.015)]" style={{top: "137px", left: "258.7px"}}>
                  <img alt="" className="size-[30px] object-contain" height="500" src="/landing/microsoft-excel.3rao4smlu35hw.svg" width="486"/>
                </span>
                <span className="absolute grid size-[59px] place-items-center rounded-[14px] bg-background shadow-[0_2px_8px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.015)]" style={{top: "137px", left: "334.7px"}}>
                  <img alt="" className="size-[30px] object-contain" height="152" src="/landing/todoist.0s-axda_lgmpd.svg" width="152"/>
                </span>
              </div>
            </div>
          </div>
          <h3 className="mt-[18.5px] text-[18px] leading-[22px] font-semibold text-foreground">Works with your stack</h3>
          <p className="mt-[10px] text-[13.6px] leading-[18px] text-foreground/80">Native MCP server, REST API, Python ADK, and PayPal sandbox integrations. Zero friction.</p>
        </motion.div>

        {/* Card 3 */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.5, delay: 0.3 }}
          whileHover={{ y: -4 }}
          className="transition-transform duration-200"
        >
          <div className="relative @container" style={{"--fit-w": 392, "--fit-h": 255, aspectRatio: "var(--fit-w) / var(--fit-h)"} as React.CSSProperties}>
            <div className="absolute top-0 left-0 origin-top-left" style={{"width": "calc(var(--fit-w) * 1px)", "height": "calc(var(--fit-h) * 1px)", scale: "tan(atan2(100cqw, var(--fit-w) * 1px))"} as React.CSSProperties}>
              <div aria-hidden={true} className="relative h-[255px] overflow-hidden rounded-[18px] border border-border bg-muted select-none">
                <div className="absolute inset-0">
                  <span className="absolute size-[46px] -translate-1/2 rounded-full bg-background p-[3px] ring-2 ring-zinc-300/70 dark:ring-zinc-600/60" style={{left: "95.5px", top: "119px"}}>
                    <img alt="" className="size-full rounded-full object-cover" height="256" src="/landing/avatar-1.3c9mk9c-13we-.jpg" width="256"/>
                  </span>
                  <span className="absolute size-[46px] -translate-1/2 rounded-full bg-background p-[3px] ring-2 ring-zinc-300/70 dark:ring-zinc-600/60" style={{left: "129px", top: "66px"}}>
                    <img alt="" className="size-full rounded-full object-cover" height="256" src="/landing/avatar-2.0787u8pfq-vwp.jpg" width="256"/>
                  </span>
                  <span className="absolute size-[46px] -translate-1/2 rounded-full bg-background p-[3px] ring-2 ring-zinc-300/70 dark:ring-zinc-600/60" style={{left: "196px", top: "42px"}}>
                    <img alt="" className="size-full rounded-full object-cover" height="256" src="/landing/avatar-3.17c_x21xbh076.jpg" width="256"/>
                  </span>
                  <span className="absolute size-[46px] -translate-1/2 rounded-full bg-background p-[3px] ring-2 ring-zinc-300/70 dark:ring-zinc-600/60" style={{left: "263px", top: "66px"}}>
                    <img alt="" className="size-full rounded-full object-cover" height="256" src="/landing/avatar-4.29tix0ql09qoa.jpg" width="256"/>
                  </span>
                  <span className="absolute size-[46px] -translate-1/2 rounded-full bg-background p-[3px] ring-2 ring-zinc-300/70 dark:ring-zinc-600/60" style={{left: "296.5px", top: "119px"}}>
                    <img alt="" className="size-full rounded-full object-cover" height="256" src="/landing/avatar-5.3mbtk5i8sfgi2.jpg" width="256"/>
                  </span>
                  <span className="absolute inline-flex -translate-1/2 overflow-hidden rounded-full p-[2px]" style={{left: "196px", top: "146px"}}>
                    <span className="absolute inset-[-100%] animate-[spin_4s_linear_infinite] bg-[conic-gradient(from_0deg_at_50%_50%,#fb923c_0deg,#f43f5e_30deg,#a855f7_60deg,transparent_110deg,transparent_360deg)] motion-reduce:animate-none"></span>
                    <span className="relative flex flex-col items-center rounded-full bg-background px-7 py-2">
                      <span className="text-[11px] font-medium text-muted-foreground">Total Allocated</span>
                      <span className="text-[24px] leading-[30px] font-bold tracking-tight text-orange-500">$32,450</span>
                    </span>
                  </span>
                  <span className="absolute bottom-[14px] left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-border bg-background/85 px-6 py-2 text-[14px] font-medium text-muted-foreground backdrop-blur">
                    <svg aria-hidden={true} className="lucide lucide-user-plus size-4" fill="none" height="24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                      <circle cx="9" cy="7" r="4"></circle>
                      <line x1="19" x2="19" y1="8" y2="14"></line>
                      <line x1="22" x2="16" y1="11" y2="11"></line>
                    </svg>
                    New Agent
                  </span>
                </div>
              </div>
            </div>
          </div>
          <h3 className="mt-[18.5px] text-[18px] leading-[22px] font-semibold text-foreground">Turn delegation into control</h3>
          <p className="mt-[10px] text-[13.6px] leading-[18px] text-foreground/80">See which child agents reserve funds, settle transactions, and stay strictly within user mandates.</p>
        </motion.div>
      </div>
    </section>
  );
}
