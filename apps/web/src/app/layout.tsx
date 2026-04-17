import type { Metadata } from "next";
import { DM_Sans, Playfair_Display } from "next/font/google";

import "./globals.css";
import { Providers } from "./providers";

import { Header } from "@/components/layout/Header";
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
          <div
            className="flex min-h-screen flex-col transition-[margin-left] duration-200"
            id="main-content"
          >
            <Header />
            <main className="flex-1 p-4 md:p-8">{children}</main>
          </div>
        </Providers>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (window.innerWidth >= 768) {
                  const stored = JSON.parse(localStorage.getItem('tb-ui-store') || '{}');
                  const sidebar = stored?.state?.sidebarOpen;
                  const ml = sidebar === false ? '64px' : '240px';
                  const mainContent = document.getElementById('main-content');
                  if (mainContent) mainContent.style.marginLeft = ml;
                }
              } catch(e) {}
            `,
          }}
        />
      </body>
    </html>
  );
}
