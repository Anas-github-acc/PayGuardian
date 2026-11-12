"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";

export function LandingFooter() {
  return (
    <footer className="dark relative overflow-hidden border-t border-transparent bg-background px-4 text-foreground in-[.dark]:border-border">
      <div className="mx-auto max-w-[1204px] pt-[64px] md:pt-[80px]">
        <div className="flex flex-col gap-[48px] lg:flex-row lg:justify-between">
          {/* Brand & info with new official PayGuardian icon */}
          <div className="max-w-[320px]">
            <Link
              className="flex items-center gap-[10px] text-[22px] font-semibold tracking-[-0.02em] text-foreground"
              href="/"
            >
              <Image
                src="/payguardian.svg"
                alt="PayGuardian Logo"
                width={26}
                height={26}
                className="size-[26px] object-contain shrink-0"
              />
              PayGuardian
            </Link>
            <p className="mt-[16px] text-[13.6px] leading-[21px] text-muted-foreground">
              Delegation Gateway for bounded, auditable authority across Personal
              Agents and specialist multi-agent trees.
            </p>
            {/* Social Icons */}
            <div className="mt-[24px] flex gap-[8px]">
              <a
                aria-label="X"
                className="grid size-[34px] place-items-center rounded-[9px] border border-border bg-muted text-muted-foreground transition-colors hover:text-foreground"
                href="https://twitter.com"
                target="_blank"
                rel="noreferrer"
              >
                <svg className="size-[15px]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z" />
                </svg>
              </a>
              <a
                aria-label="GitHub"
                className="grid size-[34px] place-items-center rounded-[9px] border border-border bg-muted text-muted-foreground transition-colors hover:text-foreground"
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
              >
                <svg className="size-[15px]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                </svg>
              </a>
              <a
                aria-label="YouTube"
                className="grid size-[34px] place-items-center rounded-[9px] border border-border bg-muted text-muted-foreground transition-colors hover:text-foreground"
                href="https://youtube.com"
                target="_blank"
                rel="noreferrer"
              >
                <svg className="size-[15px]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Navigation link columns */}
          <nav className="grid grid-cols-2 gap-x-[24px] gap-y-[40px] sm:grid-cols-4 lg:w-[640px]">
            <div>
              <h2 className="text-[13.5px] font-medium text-foreground">Product</h2>
              <ul className="mt-[16px] space-y-[10px] text-[13.6px] text-muted-foreground">
                <li>
                  <a className="transition-colors hover:text-foreground" href="#features">
                    Features
                  </a>
                </li>
                <li>
                  <a className="transition-colors hover:text-foreground" href="#pricing">
                    Pricing
                  </a>
                </li>
                <li>
                  <a className="transition-colors hover:text-foreground" href="#gateway">
                    Gateway
                  </a>
                </li>
                <li>
                  <a className="transition-colors hover:text-foreground" href="#features">
                    Changelog
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h2 className="text-[13.5px] font-medium text-foreground">Solutions</h2>
              <ul className="mt-[16px] space-y-[10px] text-[13.6px] text-muted-foreground">
                <li>
                  <a className="transition-colors hover:text-foreground" href="#solutions">
                    Personal Agents
                  </a>
                </li>
                <li>
                  <a className="transition-colors hover:text-foreground" href="#solutions">
                    Multi-Agent Trees
                  </a>
                </li>
                <li>
                  <a className="transition-colors hover:text-foreground" href="#solutions">
                    E-Commerce
                  </a>
                </li>
                <li>
                  <a className="transition-colors hover:text-foreground" href="#solutions">
                    Enterprise
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h2 className="text-[13.5px] font-medium text-foreground">Resources</h2>
              <ul className="mt-[16px] space-y-[10px] text-[13.6px] text-muted-foreground">
                <li>
                  <a className="transition-colors hover:text-foreground" href="#features">
                    Documentation
                  </a>
                </li>
                <li>
                  <a className="transition-colors hover:text-foreground" href="#features">
                    Guides
                  </a>
                </li>
                <li>
                  <a className="transition-colors hover:text-foreground" href="#faq">
                    Help Center
                  </a>
                </li>
                <li>
                  <a className="transition-colors hover:text-foreground" href="#faq">
                    API Docs
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h2 className="text-[13.5px] font-medium text-foreground">Company</h2>
              <ul className="mt-[16px] space-y-[10px] text-[13.6px] text-muted-foreground">
                <li>
                  <a className="transition-colors hover:text-foreground" href="#about">
                    About
                  </a>
                </li>
                <li>
                  <a className="transition-colors hover:text-foreground" href="#about">
                    Careers
                  </a>
                </li>
                <li>
                  <a className="transition-colors hover:text-foreground" href="#contact">
                    Contact
                  </a>
                </li>
                <li>
                  <a className="transition-colors hover:text-foreground" href="#about">
                    Press
                  </a>
                </li>
              </ul>
            </div>
          </nav>
        </div>

        {/* Bottom copyright line */}
        <div className="mt-[56px] flex flex-col gap-[12px] border-t border-border py-[24px] text-[12.5px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            © 2026 PayGuardian. All rights reserved. Crafted for Autonomous Finance.
          </p>
          <div className="flex gap-[20px]">
            <a className="transition-colors hover:text-foreground" href="#privacy">
              Privacy
            </a>
            <a className="transition-colors hover:text-foreground" href="#terms">
              Terms
            </a>
            <a className="transition-colors hover:text-foreground" href="#cookies">
              Cookies
            </a>
          </div>
        </div>
      </div>

      {/* Giant faded watermark outline text across bottom of footer */}
      <div
        aria-hidden={true}
        className="pointer-events-none -mb-[0.22em] bg-gradient-to-b from-secondary to-background bg-clip-text text-center text-[min(20vw,290px)] leading-none font-semibold tracking-[-0.05em] text-transparent select-none opacity-40"
      >
        PayGuardian
      </div>
    </footer>
  );
}
