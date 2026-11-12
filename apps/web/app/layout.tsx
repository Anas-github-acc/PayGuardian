import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "./auth-provider";
import "./globals.css";
import "katex/dist/katex.min.css";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://payguardian.ai"),
  title: "PayGuardian",
  description: "Bounded, auditable authority for delegated agents.",
  icons: {
    icon: [
      { url: "/payguardian.svg", type: "image/svg+xml" },
    ],
    shortcut: "/payguardian.svg",
    apple: "/payguardian.svg",
  },
  openGraph: {
    title: "PayGuardian — Delegation Gateway",
    description: "Bounded, auditable authority for delegated agents.",
    url: "https://payguardian.ai",
    siteName: "PayGuardian",
    images: [
      {
        url: "/payguardian.svg",
        width: 166,
        height: 152,
        alt: "PayGuardian Logo",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "PayGuardian — Delegation Gateway",
    description: "Bounded, auditable authority for delegated agents.",
    images: ["/payguardian.svg"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
