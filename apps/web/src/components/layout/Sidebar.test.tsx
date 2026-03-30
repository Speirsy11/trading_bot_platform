import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

// Mock the store
const mockToggleSidebar = vi.fn();
vi.mock("@/stores/ui", () => ({
  useUiStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      sidebarOpen: true,
      toggleSidebar: mockToggleSidebar,
    }),
}));

import { Sidebar } from "@/components/layout/Sidebar";

describe("Sidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all nav items", () => {
    render(<Sidebar />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Bots")).toBeInTheDocument();
    expect(screen.getByText("Backtest")).toBeInTheDocument();
    expect(screen.getByText("Trading")).toBeInTheDocument();
    expect(screen.getByText("Market Data")).toBeInTheDocument();
    expect(screen.getByText("History")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("renders TradeBot branding when open", () => {
    render(<Sidebar />);
    expect(screen.getByText("TradeBot")).toBeInTheDocument();
  });

  it("has collapse button with aria-label", () => {
    render(<Sidebar />);
    expect(screen.getByLabelText("Collapse sidebar")).toBeInTheDocument();
  });
});
