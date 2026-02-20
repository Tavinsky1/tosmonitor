import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "ToS Monitor — Know When Your Vendors Change the Rules",
  description:
    "Monitor Terms of Service and Privacy Policy changes from 20+ SaaS companies. Get plain-language alerts when something important changes.",
  keywords: [
    "terms of service monitor",
    "privacy policy tracker",
    "ToS changes",
    "compliance monitoring",
    "API changes",
  ],
  openGraph: {
    title: "ToS Monitor — Know When Your Vendors Change the Rules",
    description:
      "We watch Terms of Service and Privacy Policies for you. Get alerted when something important changes.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Inter:wght@300;400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased"><Providers>{children}</Providers></body>
    </html>
  );
}
