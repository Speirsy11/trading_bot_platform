"use client";

import { SidebarMarginSync } from "@/components/layout/SidebarMarginSync";
import { Toaster } from "@/components/ui/Toaster";
import { SocketProvider } from "@/providers/SocketProvider";
import { TRPCProvider } from "@/providers/TRPCProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TRPCProvider>
      <SocketProvider>
        <SidebarMarginSync />
        {children}
        <Toaster />
      </SocketProvider>
    </TRPCProvider>
  );
}
