import type { ReactNode } from "react";

interface PageCanvasProps {
  themeId: string;
  pageId: "homepage" | "dashboard" | "trading" | "bots";
  children?: ReactNode;
}

export function PageCanvas({ themeId, pageId, children }: PageCanvasProps) {
  return (
    <main className="page-canvas" data-theme={themeId} data-page={pageId}>
      {children}
    </main>
  );
}
