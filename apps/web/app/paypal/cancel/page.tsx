import { Suspense } from "react";
import { PayPalStatus } from "../../components/paypal-status";

export default function PayPalCancelPage() {
  return (
    <Suspense
      fallback={
        <main className="shell">
          <p>Loading PayPal status…</p>
        </main>
      }
    >
      <PayPalStatus cancelled />
    </Suspense>
  );
}
