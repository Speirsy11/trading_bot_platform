import type { Metadata } from "next";
import { DM_Sans, Playfair_Display } from "next/font/google";

import "./globals.css";
import { Providers } from "./providers";

import { Header } from "@/components/layout/Header";
import { MainContent } from "@/components/layout/MainContent";
import { Sidebar } from "@/components/layout/Sidebar";

export const metadata: Metadata = {
  title: "Obsidian Vault · Trading Platform",
  description: "Institutional-grade crypto trading platform",
};

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${dmSans.variable} ${playfair.variable} min-h-screen`}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:left-4 focus:top-4 focus:rounded focus:px-4 focus:py-2"
          style={{ background: "var(--accent)", color: "#08080a" }}
        >
          Skip to content
        </a>
        <Providers>
          <Sidebar />
          <MainContent>
            <Header />
            <main className="flex-1 p-4 md:p-8">{children}</main>
          </MainContent>
        </Providers>
      </body>
    </html>
  );
}
