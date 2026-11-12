"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, type Variants } from "motion/react";
import { useAuth } from "@/app/auth-provider";
import { cn } from "@/lib/utils";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { FancyButton } from "@/components/ui/pricing-9-utils/fancy-button";
import {
  ArrowUpRightIcon,
  ChartLineIcon,
  CheckIcon,
  CodeIcon,
  DatabaseIcon,
  LockIcon,
  RepeatIcon,
  SettingsIcon,
} from "lucide-react";

const animVariant: Variants = {
  initial: { opacity: 0, y: 10, filter: "blur(4px)", scale: 0.98 },
  animate: (i: number) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    scale: 1,
    transition: {
      delay: i * 0.03,
      type: "spring",
      damping: 22,
      stiffness: 280,
    },
  }),
  exit: {
    opacity: 0,
    y: -10,
    filter: "blur(4px)",
    scale: 0.98,
    transition: { duration: 0.14 },
  },
};

type FeatureToggle = {
  id: string;
  label: string;
  icon?: React.ReactNode;
  price: number;
  enabled: boolean;
};

const defaultFeatures: FeatureToggle[] = [
  {
    id: "analytics",
    label: "Spend analytics engine",
    icon: <ChartLineIcon className="size-4" />,
    price: 0,
    enabled: true,
  },
  {
    id: "api",
    label: "API & MCP gateway",
    icon: <CodeIcon className="size-4" />,
    price: 0,
    enabled: true,
  },
  {
    id: "storage",
    label: "Immutable audit ledger storage",
    icon: <DatabaseIcon className="size-4" />,
    price: 0,
    enabled: true,
  },
  {
    id: "automation",
    label: "Multi-hop delegation trees",
    icon: <RepeatIcon className="size-4" />,
    price: 0,
    enabled: true,
  },
  {
    id: "security",
    label: "Cryptographic mandate authority",
    icon: <LockIcon className="size-4" />,
    price: 0,
    enabled: true,
  },
  {
    id: "custom",
    label: "PayPal Sandbox settlement",
    icon: <SettingsIcon className="size-4" />,
    price: 0,
    enabled: true,
  },
];

const includedFeatures = [
  "Unlimited active agents & subagent mandates",
  "Core dashboard & visual trace inspection",
  "Full REST API & MCP server access",
  "Double-entry budget ledger reconciliation",
];

const basePrice = 0;

export function Pricing() {
  const { user } = useAuth();
  const [features, setFeatures] = useState<FeatureToggle[]>(defaultFeatures);

  const totalPrice =
    basePrice + features.filter((f) => f.enabled).reduce((sum, f) => sum + f.price, 0);

  const priceChars = totalPrice.toString().split("");

  const toggleFeature = (id: string) => {
    setFeatures((prev) => prev.map((f) => (f.id === id ? { ...f, enabled: !f.enabled } : f)));
  };

  return (
    <section
      id="pricing"
      aria-label="Pricing"
      className="scroll-mt-[64px] bg-background px-4 py-[64px] md:py-[88px]"
    >
      <div className="mx-auto w-full max-w-4xl flex flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <Badge variant="secondary" className="w-fit">
            Public Beta · 100% Free
          </Badge>
          <h2 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Only pay for what you need
          </h2>
          <p className="max-w-2xl text-lg text-muted-foreground">
            PayGuardian is currently free during public beta. All modules, delegation limits, and
            cryptographic mandate tools are completely unlocked.
          </p>
        </div>

        <div className="grid w-full grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Add-on modules toggle card */}
          <div className="flex flex-col gap-6 rounded-3xl bg-card p-8 shadow-sm">
            <div className="flex flex-col gap-2">
              <h3 className="text-lg font-medium text-foreground">Add-on modules</h3>
              <p className="text-sm text-muted-foreground">
                Toggle the features you need. All modules are free during beta.
              </p>
            </div>

            <div className="flex flex-col gap-4">
              {features.map((feature) => (
                <div
                  key={feature.id}
                  className="flex items-center justify-between gap-4 rounded-lg p-2"
                >
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => toggleFeature(feature.id)}
                    className="h-auto flex-1 justify-start rounded-lg px-0 py-0 hover:bg-transparent"
                  >
                    <div className="flex items-center gap-3 text-left">
                      <div
                        className={`flex size-9 items-center justify-center rounded-full transition-colors ${
                          feature.enabled
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {feature.icon}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-foreground">{feature.label}</span>
                        <span className="text-start text-xs text-muted-foreground">
                          +$0/mo (Free in Beta)
                        </span>
                      </div>
                    </div>
                  </Button>
                  <Switch
                    checked={feature.enabled}
                    onCheckedChange={() => toggleFeature(feature.id)}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Your plan summary card */}
          <div className="flex flex-col gap-6 rounded-3xl bg-muted p-8">
            <div className="flex flex-col gap-2">
              <h3 className="text-xl font-medium text-foreground">Your plan</h3>
              <p className="text-sm text-muted-foreground">
                Base plan + {features.filter((f) => f.enabled).length} add-ons selected
              </p>
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-baseline gap-1">
                <span className="text-7xl font-semibold tracking-tight text-foreground">$</span>
                <AnimatePresence mode="popLayout">
                  {priceChars.map((char, idx) => (
                    <motion.span
                      key={`${totalPrice}-${char}-${idx}`}
                      variants={animVariant}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      custom={idx}
                      className="inline-block text-7xl font-semibold tracking-tight text-foreground"
                    >
                      {char}
                    </motion.span>
                  ))}
                </AnimatePresence>
                <span key="period" className="text-xl text-muted-foreground">
                  /month
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Base: ${basePrice} + Add-ons: ${totalPrice - basePrice} (Free in Public Beta)
              </p>
            </div>

            <Link href={user ? "/dashboard" : "/login"} className="w-full">
              <FancyButton size="lg" className="w-full">
                {user ? "Go to Dashboard" : "Get started free"}
                <ArrowUpRightIcon className="size-4" />
              </FancyButton>
            </Link>

            <div className="flex flex-col gap-3 pt-2 border-t border-border/40">
              <p className="text-sm font-medium text-foreground">Always included</p>
              <ul className="flex flex-col gap-3">
                {includedFeatures.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary">
                      <CheckIcon className="size-3 text-primary-foreground" />
                    </div>
                    <span className="text-sm text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export { Pricing as PricingSection };
export default Pricing;
