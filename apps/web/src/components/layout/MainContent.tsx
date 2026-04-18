"use client";

import { useEffect, useState } from "react";

import { useUiStore } from "@/stores/ui";

export function MainContent({ children }: { children: React.ReactNode }) {
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const marginLeft = mounted ? (sidebarOpen ? 240 : 64) : 240;

  return (
    <div
      className="flex min-h-screen flex-col transition-[margin-left] duration-200"
      id="main-content"
      style={{ marginLeft: `${marginLeft}px` }}
    >
      {children}
    </div>
  );
}
