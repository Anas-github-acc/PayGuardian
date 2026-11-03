"use client";

import * as React from "react";
import { AuthBoundary } from "../auth-provider";
import { FirstTimeEnvironmentSlideFlow } from "../../components/onboarding";

export default function OnboardingPage() {
  return (
    <AuthBoundary>
      <FirstTimeEnvironmentSlideFlow />
    </AuthBoundary>
  );
}
