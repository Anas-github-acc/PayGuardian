import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AuthProvider } from "./auth-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "PayGuardian",
  description: "Bounded, auditable authority for delegated agents.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
