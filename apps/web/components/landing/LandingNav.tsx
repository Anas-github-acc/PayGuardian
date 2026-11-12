"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronDown, Moon, Sun, Bot, Layers, Terminal, Building2, Lock } from "lucide-react";
import { useAuth } from "@/app/auth-provider";

interface LandingNavProps {
  onToggleTheme?: () => void;
  isDark?: boolean;
}

export function LandingNav({ onToggleTheme, isDark = true }: LandingNavProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useAuth();

  return (
    <header className="group/header sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="relative mx-auto flex h-[64px] max-w-[calc(1204px+2rem)] items-center px-4 lg:h-[72px]">
        {/* Brand Logo with new official PayGuardian icon */}
        <Link
          className="flex items-center gap-[10px] text-[22px] font-semibold tracking-[-0.02em] text-foreground"
          href="/"
        >
          <Image
            src="/payguardian.svg"
            alt="PayGuardian Logo"
            width={28}
            height={26}
            className="size-[26px] object-contain shrink-0"
            priority
          />
          PayGuardian
        </Link>

        {/* Desktop Nav */}
        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-[4px] lg:flex">
          <a
            className="inline-flex h-[32px] items-center gap-[5px] rounded-[8px] px-[12px] text-[14px] font-medium text-foreground/80 transition-colors hover:bg-primary/[0.04] hover:text-foreground"
            href="#features"
          >
            Platform
          </a>
          <a
            className="inline-flex h-[32px] items-center gap-[5px] rounded-[8px] px-[12px] text-[14px] font-medium text-foreground/80 transition-colors hover:bg-primary/[0.04] hover:text-foreground"
            href="#gateway"
          >
            Gateway
            <span className="rounded-[5px] border border-[#f6ddd2] dark:border-[#4f3327] bg-[#fdf1ec] dark:bg-[#321d15] px-[5px] text-[8.5px] leading-[15px] font-semibold tracking-[0.02em] text-[#dd6b47]">
              NEW
            </span>
          </a>

          {/* Solutions Dropdown */}
          <div className="group relative">
            <button
              type="button"
              className="inline-flex h-[32px] items-center gap-[5px] rounded-[8px] px-[12px] text-[14px] font-medium text-foreground/80 transition-colors hover:bg-primary/[0.04] hover:text-foreground group-hover:bg-primary/[0.04] group-focus-within:bg-primary/[0.04]"
            >
              Solutions
              <ChevronDown className="size-[14px] text-muted-foreground transition-transform group-focus-within:rotate-180 group-hover:rotate-180" />
            </button>
            <div className="invisible absolute top-full left-1/2 -translate-x-1/2 pt-[10px] opacity-0 transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
              <ul className="w-[320px] rounded-[14px] border border-border bg-background p-[6px] shadow-[0_16px_40px_-12px_rgba(0,0,0,0.16)]">
                <li>
                  <a
                    className="flex items-start gap-[12px] rounded-[10px] p-[10px] transition-colors hover:bg-accent"
                    href="#solutions"
                  >
                    <span className="grid size-[32px] shrink-0 place-items-center rounded-[8px] border border-border bg-background">
                      <Bot className="size-[16px] text-foreground/80" />
                    </span>
                    <span>
                      <span className="block text-[14px] leading-[18px] font-medium text-foreground">
                        For Personal Agents
                      </span>
                      <span className="mt-[2px] block text-[12.5px] leading-[17px] text-muted-foreground">
                        Connect Claude, ChatGPT & root assistants
                      </span>
                    </span>
                  </a>
                </li>
                <li>
                  <a
                    className="flex items-start gap-[12px] rounded-[10px] p-[10px] transition-colors hover:bg-accent"
                    href="#solutions"
                  >
                    <span className="grid size-[32px] shrink-0 place-items-center rounded-[8px] border border-border bg-background">
                      <Layers className="size-[16px] text-foreground/80" />
                    </span>
                    <span>
                      <span className="block text-[14px] leading-[18px] font-medium text-foreground">
                        For Multi-Agent Trees
                      </span>
                      <span className="mt-[2px] block text-[12.5px] leading-[17px] text-muted-foreground">
                        Subagent delegation with bounded budgets
                      </span>
                    </span>
                  </a>
                </li>
                <li>
                  <a
                    className="flex items-start gap-[12px] rounded-[10px] p-[10px] transition-colors hover:bg-accent"
                    href="#solutions"
                  >
                    <span className="grid size-[32px] shrink-0 place-items-center rounded-[8px] border border-border bg-background">
                      <Terminal className="size-[16px] text-foreground/80" />
                    </span>
                    <span>
                      <span className="block text-[14px] leading-[18px] font-medium text-foreground">
                        For Developers & MCP
                      </span>
                      <span className="mt-[2px] block text-[12.5px] leading-[17px] text-muted-foreground">
                        Model Context Protocol & REST gateway
                      </span>
                    </span>
                  </a>
                </li>
                <li>
                  <a
                    className="flex items-start gap-[12px] rounded-[10px] p-[10px] transition-colors hover:bg-accent"
                    href="#solutions"
                  >
                    <span className="grid size-[32px] shrink-0 place-items-center rounded-[8px] border border-border bg-background">
                      <Building2 className="size-[16px] text-foreground/80" />
                    </span>
                    <span>
                      <span className="block text-[14px] leading-[18px] font-medium text-foreground">
                        For Enterprise
                      </span>
                      <span className="mt-[2px] block text-[12.5px] leading-[17px] text-muted-foreground">
                        RBAC, policy controls and immutable audit logs
                      </span>
                    </span>
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <a
            className="inline-flex h-[32px] items-center gap-[5px] rounded-[8px] px-[12px] text-[14px] font-medium text-foreground/80 transition-colors hover:bg-primary/[0.04] hover:text-foreground"
            href="#pricing"
          >
            Pricing
          </a>
          <a
            className="inline-flex h-[32px] items-center gap-[5px] rounded-[8px] px-[12px] text-[14px] font-medium text-foreground/80 transition-colors hover:bg-primary/[0.04] hover:text-foreground"
            href="#faq"
          >
            FAQ
          </a>
        </nav>

        {/* Right Actions */}
        <div className="ml-auto flex items-center gap-[12px]">
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label="Toggle theme"
            className="grid size-[34px] place-items-center rounded-[9px] text-foreground/80 transition-colors hover:bg-primary/[0.04] hover:text-foreground"
          >
            {isDark ? <Sun className="size-[17px]" /> : <Moon className="size-[17px]" />}
          </button>

          {!user && (
            <Link
              className="hidden h-[34px] items-center rounded-[9px] border border-border bg-muted px-[16px] text-[14px] text-foreground/80 transition-colors hover:bg-accent sm:inline-flex"
              href="/login"
            >
              Sign in
            </Link>
          )}

          <a
            href={
              process.env.NEXT_PUBLIC_GITHUB_URL || "https://github.com/Anas-github-acc/PayGuardian"
            }
            target="_blank"
            rel="noopener noreferrer"
            aria-label="PayGuardian GitHub Repository"
            className="grid size-[34px] place-items-center rounded-[9px] text-foreground/80 transition-colors hover:bg-primary/[0.04] hover:text-foreground"
          >
            <svg className="size-[20px] fill-current" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
              />
            </svg>
          </a>

          {/* Mobile hamburger button */}
          <button
            type="button"
            className="relative ml-[4px] grid size-8 place-items-center lg:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            <span className="relative size-4">
              <span
                className={`absolute left-0 block h-0.5 w-4 bg-foreground transition-all duration-200 ${
                  mobileOpen ? "top-[0.4rem] -rotate-45" : "top-1"
                }`}
              />
              <span
                className={`absolute left-0 block h-0.5 w-4 bg-foreground transition-all duration-200 ${
                  mobileOpen ? "top-[0.4rem] rotate-45" : "top-2.5"
                }`}
              />
            </span>
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <nav className="fixed inset-x-0 top-[65px] bottom-0 m-0 h-[calc(100vh-65px)] w-full overflow-y-auto bg-background/95 backdrop-blur-xl lg:hidden">
          <div className="flex flex-col gap-[28px] px-[16px] py-[24px]">
            <ul className="flex flex-col gap-[14px]">
              <li>
                <a
                  className="flex items-center gap-[8px] text-[22px] font-medium text-foreground"
                  href="#features"
                  onClick={() => setMobileOpen(false)}
                >
                  Platform
                </a>
              </li>
              <li>
                <a
                  className="flex items-center gap-[8px] text-[22px] font-medium text-foreground"
                  href="#gateway"
                  onClick={() => setMobileOpen(false)}
                >
                  Gateway
                  <span className="rounded-[5px] border border-[#f6ddd2] dark:border-[#4f3327] bg-[#fdf1ec] dark:bg-[#321d15] px-[5px] text-[8.5px] leading-[15px] font-semibold tracking-[0.02em] text-[#dd6b47]">
                    NEW
                  </span>
                </a>
              </li>
              <li>
                <a
                  className="flex items-center gap-[8px] text-[22px] font-medium text-foreground"
                  href="#pricing"
                  onClick={() => setMobileOpen(false)}
                >
                  Pricing
                </a>
              </li>
              <li>
                <a
                  className="flex items-center gap-[8px] text-[22px] font-medium text-foreground"
                  href="#faq"
                  onClick={() => setMobileOpen(false)}
                >
                  FAQ
                </a>
              </li>
            </ul>

            <div>
              <div className="text-[13px] font-medium text-muted-foreground/70">Solutions</div>
              <ul className="mt-[10px] flex flex-col gap-[4px]">
                <li>
                  <a
                    className="flex items-center gap-[12px] rounded-[10px] py-[8px]"
                    href="#solutions"
                    onClick={() => setMobileOpen(false)}
                  >
                    <span className="grid size-[32px] shrink-0 place-items-center rounded-[8px] border border-border">
                      <Bot className="size-[16px] text-foreground/80" />
                    </span>
                    <span>
                      <span className="block text-[15px] font-medium text-foreground">
                        For Personal Agents
                      </span>
                      <span className="block text-[12.5px] text-muted-foreground">
                        Connect Claude, ChatGPT & root assistants
                      </span>
                    </span>
                  </a>
                </li>
                <li>
                  <a
                    className="flex items-center gap-[12px] rounded-[10px] py-[8px]"
                    href="#solutions"
                    onClick={() => setMobileOpen(false)}
                  >
                    <span className="grid size-[32px] shrink-0 place-items-center rounded-[8px] border border-border">
                      <Layers className="size-[16px] text-foreground/80" />
                    </span>
                    <span>
                      <span className="block text-[15px] font-medium text-foreground">
                        For Multi-Agent Trees
                      </span>
                      <span className="block text-[12.5px] text-muted-foreground">
                        Subagent delegation with bounded budgets
                      </span>
                    </span>
                  </a>
                </li>
                <li>
                  <a
                    className="flex items-center gap-[12px] rounded-[10px] py-[8px]"
                    href="#solutions"
                    onClick={() => setMobileOpen(false)}
                  >
                    <span className="grid size-[32px] shrink-0 place-items-center rounded-[8px] border border-border">
                      <Terminal className="size-[16px] text-foreground/80" />
                    </span>
                    <span>
                      <span className="block text-[15px] font-medium text-foreground">
                        For Developers & MCP
                      </span>
                      <span className="block text-[12.5px] text-muted-foreground">
                        Model Context Protocol & REST gateway
                      </span>
                    </span>
                  </a>
                </li>
                <li>
                  <a
                    className="flex items-center gap-[12px] rounded-[10px] py-[8px]"
                    href="#solutions"
                    onClick={() => setMobileOpen(false)}
                  >
                    <span className="grid size-[32px] shrink-0 place-items-center rounded-[8px] border border-border">
                      <Building2 className="size-[16px] text-foreground/80" />
                    </span>
                    <span>
                      <span className="block text-[15px] font-medium text-foreground">
                        For Enterprise
                      </span>
                      <span className="block text-[12.5px] text-muted-foreground">
                        RBAC, policy controls and immutable audit logs
                      </span>
                    </span>
                  </a>
                </li>
              </ul>
            </div>

            <Link
              className="grid h-[44px] place-items-center rounded-[10px] border border-border bg-muted text-[15px] text-foreground/80 sm:hidden"
              href={user ? "/dashboard" : "/login"}
              onClick={() => setMobileOpen(false)}
            >
              {user ? "Go to Dashboard" : "Sign in"}
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
