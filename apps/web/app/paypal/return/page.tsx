import { Suspense } from "react";
import { AuthBoundary } from "../../auth-provider";
import { PayPalStatus } from "../../components/paypal-status";

export default function PayPalReturnPage() {
  return (
    <AuthBoundary>
      <Suspense
        fallback={
          <main className="shell">
            <p>Loading PayPal status…</p>
          </main>
        }
      >
        <PayPalStatus />
      </Suspense>
    </AuthBoundary>
  );
}
