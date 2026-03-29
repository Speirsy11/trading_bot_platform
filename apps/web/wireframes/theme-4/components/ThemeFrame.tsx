import type { ReactNode } from "react";

import { PageCanvas } from "../../shared/components/PageCanvas";

interface ThemeFrameProps {
  page: "homepage" | "dashboard" | "trading" | "bots";
  children?: ReactNode;
}

export function Theme4Frame({ page, children }: ThemeFrameProps) {
  return (
    <PageCanvas themeId="theme-4" pageId={page}>
      {children}
    </PageCanvas>
  );
}
