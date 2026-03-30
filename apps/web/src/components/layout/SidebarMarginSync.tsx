"use client";

import { useEffect } from "react";

import { useUiStore } from "@/stores/ui";

export function SidebarMarginSync() {
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const el = document.getElementById("main-content");
    if (el) {
      el.style.marginLeft = sidebarOpen ? "240px" : "64px";
    }
  }, [sidebarOpen]);

  return null;
}
