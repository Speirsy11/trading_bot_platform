"use client";

import { SidebarMarginSync } from "@/components/layout/SidebarMarginSync";
import { ColourSchemeProvider } from "@/providers/ColourSchemeProvider";
import { SocketProvider } from "@/providers/SocketProvider";
import { TRPCProvider } from "@/providers/TRPCProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TRPCProvider>
      <SocketProvider>
        <ColourSchemeProvider>
          <SidebarMarginSync />
          {children}
        </ColourSchemeProvider>
      </SocketProvider>
    </TRPCProvider>
  );
}
