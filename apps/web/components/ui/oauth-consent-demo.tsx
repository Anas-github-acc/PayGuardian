import OAuthConsentCard from "@/components/ui/oauth-consent-react";

export default function OAuthConsentDemo() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <OAuthConsentCard
          clientName="Hotel Specialist"
          productName="PayGuardian Gateway"
          redirectUri="https://payguardian.internal/gateway/callback"
          email="operator@payguardian.local"
          scopes={["mandates:execute", "payments:reserve"]}
          amountMinor={25000}
          currency="USD"
          recipient="Grand Hyatt City Center"
          mandateId="mandate-child-hotel-01"
        />
      </div>
    </div>
  );
}
