import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { ColourSchemeProvider, COLOUR_SCHEMES } from "@/providers/ColourSchemeProvider";

vi.mock("@/stores/ui", () => {
  let scheme = "glacier";
  return {
    useUiStore: (selector: (s: Record<string, unknown>) => unknown) =>
      selector({
        colourScheme: scheme,
        setColourScheme: (s: string) => {
          scheme = s;
        },
      }),
  };
});

describe("ColourSchemeProvider", () => {
  it("sets data-color-scheme attribute", () => {
    render(
      <ColourSchemeProvider>
        <div>child</div>
      </ColourSchemeProvider>
    );
    expect(document.documentElement.dataset.colorScheme).toBe("glacier");
  });

  it("renders children", () => {
    render(
      <ColourSchemeProvider>
        <span data-testid="inner">Hello</span>
      </ColourSchemeProvider>
    );
    expect(screen.getByTestId("inner")).toHaveTextContent("Hello");
  });
});

describe("COLOUR_SCHEMES", () => {
  it("has 5 themes", () => {
    expect(COLOUR_SCHEMES).toHaveLength(5);
  });

  it("includes glacier as default", () => {
    expect(COLOUR_SCHEMES.find((c) => c.id === "glacier")).toBeDefined();
  });

  it("each has id, label, swatch", () => {
    for (const cs of COLOUR_SCHEMES) {
      expect(cs.id).toBeTruthy();
      expect(cs.label).toBeTruthy();
      expect(cs.swatch).toMatch(/^#/);
    }
  });
});
