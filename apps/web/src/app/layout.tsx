import type { Metadata } from "next";
import { Crimson_Pro, Outfit } from "next/font/google";

import "./globals.css";
import { Providers } from "./providers";

import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";

export const metadata: Metadata = {
  title: "Trading Bot Platform",
  description: "Crypto trading bot platform with backtesting and live trading",
};

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const crimsonPro = Crimson_Pro({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-color-scheme="glacier" suppressHydrationWarning>
      <body className={`${outfit.variable} ${crimsonPro.variable} min-h-screen`}>
        <Providers>
          <Sidebar />
          <div
            className="flex min-h-screen flex-col transition-[margin-left] duration-200"
            id="main-content"
          >
            <Header />
            <main className="flex-1 p-6">{children}</main>
          </div>
        </Providers>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const stored = JSON.parse(localStorage.getItem('tb-ui-store') || '{}');
                const scheme = stored?.state?.colourScheme;
                if (scheme) document.documentElement.dataset.colorScheme = scheme;
                const sidebar = stored?.state?.sidebarOpen;
                const ml = sidebar === false ? '64px' : '220px';
                const mainContent = document.getElementById('main-content');
                if (mainContent) mainContent.style.marginLeft = ml;
              } catch(e) {}
            `,
          }}
        />
      </body>
    </html>
  );
}
