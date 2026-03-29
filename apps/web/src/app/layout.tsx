import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Trading Bot Platform",
  description: "Crypto trading bot platform with backtesting and live trading",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
