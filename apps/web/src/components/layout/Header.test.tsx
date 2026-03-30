import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("@/stores/ui", () => ({
  useUiStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      selectedSymbol: "ETH/USDT",
    }),
}));

vi.mock("@/providers/SocketProvider", () => ({
  useSocket: () => ({ isConnected: true }),
}));

import { Header } from "@/components/layout/Header";

describe("Header", () => {
  it("shows selected symbol", () => {
    render(<Header />);
    expect(screen.getByText("ETH/USDT")).toBeInTheDocument();
  });

  it("shows Live when connected", () => {
    render(<Header />);
    expect(screen.getByText("Live")).toBeInTheDocument();
  });

  it("renders notification button", () => {
    render(<Header />);
    expect(screen.getByLabelText("Notifications")).toBeInTheDocument();
  });
});
