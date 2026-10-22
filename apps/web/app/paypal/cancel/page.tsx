import { Suspense } from "react";
import { AuthBoundary } from "../../auth-provider";
import { PayPalStatus } from "../../components/paypal-status";

export default function PayPalCancelPage() {
  return (
    <AuthBoundary>
      <Suspense
        fallback={
          <main className="shell">
            <p>Loading PayPal status…</p>
          </main>
        }
      >
        <PayPalStatus cancelled />
      </Suspense>
    </AuthBoundary>
  );
}
