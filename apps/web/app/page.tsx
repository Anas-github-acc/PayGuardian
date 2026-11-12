"use client";

import React, { useState } from "react";
import { LandingNav } from "@/components/landing/LandingNav";
import { LandingHero } from "@/components/landing/LandingHero";
import { LogoStrip } from "@/components/landing/LogoStrip";
import { FeaturesGrid } from "@/components/landing/FeaturesGrid";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { SectionAlternating } from "@/components/landing/SectionAlternating";
import { Testimonials } from "@/components/landing/Testimonials";
import { PricingSection } from "@/components/landing/PricingSection";
import { FAQ } from "@/components/landing/FAQ";
import { FooterCTA } from "@/components/landing/FooterCTA";
import { LandingFooter } from "@/components/landing/LandingFooter";

export default function RootLandingPage() {
  const [isDark, setIsDark] = useState(true);

  const toggleTheme = () => {
    setIsDark((prev) => !prev);
  };

  return (
    <div
      className={`landing-container min-h-screen text-foreground antialiased selection:bg-primary/20 selection:text-foreground ${
        isDark ? "dark" : "light"
      }`}
    >
      <LandingNav isDark={isDark} onToggleTheme={toggleTheme} />
      <main>
        <LandingHero />
        <LogoStrip />
        <FeaturesGrid />
        <HowItWorks />
        <SectionAlternating />
        <Testimonials />
        <PricingSection />
        <FAQ />
        <FooterCTA />
      </main>
      <LandingFooter />
    </div>
  );
}
