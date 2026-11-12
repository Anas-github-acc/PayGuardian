"use client";

import React from "react";
import Image from "next/image";

interface EcosystemPartner {
  name: string;
  category: string;
  icon?: string;
  customIcon?: React.ReactNode;
}

const ECOSYSTEM: EcosystemPartner[] = [
  {
    name: "OpenAI",
    category: "LLM & Swarm",
    icon: "/landing/openai.1z8ot1lxof1ck.svg",
  },
  {
    name: "Claude & MCP",
    category: "Anthropic Protocol",
    customIcon: (
      <svg className="size-[20px] text-[#d0785a]" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M12 7v10M8 12h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    name: "Google Gemini",
    category: "Gemini 2.5 ADK",
    icon: "/landing/gemini.0i0maf4iixpdu.svg",
  },
  {
    name: "LangChain",
    category: "LangGraph",
    customIcon: (
      <svg className="size-[20px] text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    name: "CrewAI",
    category: "Multi-Agent Trees",
    customIcon: (
      <svg className="size-[20px] text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    name: "PayPal Sandbox",
    category: "Settlement Rails",
    customIcon: (
      <svg className="size-[20px] text-[#0079C1]" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.067 8.478c.492.315.844.825.968 1.488.513 2.748-1.503 5.485-4.502 6.113-.746.156-1.507.214-2.268.214h-.735a1.144 1.144 0 0 0-1.13.963l-.78 4.296-.037.202a.853.853 0 0 1-.84.706H6.945a.684.684 0 0 1-.676-.798l3.14-17.305A1.14 1.14 0 0 1 10.534 3.4h5.684c2.253 0 4.095 1.11 3.849 5.078z" />
      </svg>
    ),
  },
  {
    name: "DeepSeek",
    category: "Reasoning Models",
    icon: "/landing/deepseek.2s6gyjzmgf_ox.svg",
  },
  {
    name: "Microsoft AutoGen",
    category: "Agent Workflows",
    icon: "/landing/microsoft-copilot.1k597barwg6ia.svg",
  },
  {
    name: "Meta Llama",
    category: "Open Runtimes",
    customIcon: (
      <svg className="size-[20px] text-blue-500" viewBox="0 0 24 24" fill="currentColor">
        <path d="M6.915 4.03c-1.968 0-3.683 1.28-4.871 3.113C.704 9.208 0 11.883 0 14.449c0 .706.07 1.369.21 1.973a6.624 6.624 0 0 0 .265.86 5.297 5.297 0 0 0 .371.761c.696 1.159 1.818 1.927 3.593 1.927 1.497 0 2.633-.671 3.965-2.444.76-1.012 1.144-1.626 2.663-4.32l.756-1.339.186-.325c.061.1.121.196.183.3l2.152 3.595c.724 1.21 1.665 2.556 2.47 3.314 1.046.987 1.992 1.22 3.06 1.22 1.075 0 1.876-.355 2.455-.843a3.743 3.743 0 0 0 .81-.973c.542-.939.861-2.127.861-3.745 0-2.72-.681-5.357-2.084-7.45-1.282-1.912-2.957-2.93-4.716-2.93-1.047 0-2.088.467-3.053 1.308-.652.57-1.257 1.29-1.82 2.050-.69-.875-1.335-1.547-1.958-2.056-1.182-.966-2.315-1.303-3.454-1.303z" />
      </svg>
    ),
  },
  {
    name: "Python ADK & Fastify",
    category: "SDK & Gateway API",
    customIcon: (
      <svg className="size-[20px] text-yellow-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    ),
  },
];

export function LogoStrip() {
  return (
    <section className="bg-background pt-[36px] pb-[52px]">
      <p className="text-center text-[13.5px] font-medium tracking-tight text-muted-foreground/80">
        Interoperable with leading AI models, agent frameworks & payment rails
      </p>

      <div className="mt-[20px] overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_12%,#000_88%,transparent)]">
        <div className="flex w-max animate-marquee hover:[animation-play-state:paused] motion-reduce:animate-none">
          {/* Loop Set 1 */}
          <ul aria-hidden={false} className="flex items-center">
            {ECOSYSTEM.map((item, idx) => (
              <li
                key={idx}
                className="flex items-center gap-[10px] px-[32px] leading-none whitespace-nowrap text-muted-foreground/80 hover:text-foreground transition-colors cursor-default"
              >
                {item.icon ? (
                  <Image
                    src={item.icon}
                    alt={item.name}
                    width={20}
                    height={20}
                    className="size-[20px] object-contain shrink-0 opacity-80"
                  />
                ) : (
                  item.customIcon
                )}
                <div className="flex flex-col text-left">
                  <span className="text-[15.5px] font-semibold text-foreground/85">
                    {item.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground/60 font-medium">
                    {item.category}
                  </span>
                </div>
              </li>
            ))}
          </ul>

          {/* Loop Set 2 (for seamless infinite loop) */}
          <ul aria-hidden={true} className="flex items-center">
            {ECOSYSTEM.map((item, idx) => (
              <li
                key={`dup-${idx}`}
                className="flex items-center gap-[10px] px-[32px] leading-none whitespace-nowrap text-muted-foreground/80 hover:text-foreground transition-colors cursor-default"
              >
                {item.icon ? (
                  <Image
                    src={item.icon}
                    alt={item.name}
                    width={20}
                    height={20}
                    className="size-[20px] object-contain shrink-0 opacity-80"
                  />
                ) : (
                  item.customIcon
                )}
                <div className="flex flex-col text-left">
                  <span className="text-[15.5px] font-semibold text-foreground/85">
                    {item.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground/60 font-medium">
                    {item.category}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
