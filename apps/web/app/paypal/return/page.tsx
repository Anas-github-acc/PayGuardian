import { Suspense } from "react";
import { PayPalStatus } from "../../components/paypal-status";

export default function PayPalReturnPage() {
  return (
    <Suspense
      fallback={
        <main className="shell">
          <p>Loading PayPal status…</p>
        </main>
      }
    >
      <PayPalStatus />
    </Suspense>
  );
}
