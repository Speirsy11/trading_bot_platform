import type { ReactNode } from "react";

import { PageCanvas } from "../../shared/components/PageCanvas";

interface ThemeFrameProps {
  page: "homepage" | "dashboard" | "trading" | "bots";
  children?: ReactNode;
}

export function Theme2Frame({ page, children }: ThemeFrameProps) {
  return (
    <PageCanvas themeId="theme-2" pageId={page}>
      {children}
    </PageCanvas>
  );
}
