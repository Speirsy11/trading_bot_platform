import type { ReactNode } from "react";

import { PageCanvas } from "../../shared/components/PageCanvas";

interface ThemeFrameProps {
  page: "homepage" | "dashboard" | "trading" | "bots";
  children?: ReactNode;
}

export function Theme1Frame({ page, children }: ThemeFrameProps) {
  return (
    <PageCanvas themeId="theme-1" pageId={page}>
      {children}
    </PageCanvas>
  );
}
