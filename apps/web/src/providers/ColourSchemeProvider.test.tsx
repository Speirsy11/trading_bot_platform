import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { ColourSchemeProvider } from "@/providers/ColourSchemeProvider";

describe("ColourSchemeProvider", () => {
  it("renders children", () => {
    render(
      <ColourSchemeProvider>
        <span data-testid="inner">Hello</span>
      </ColourSchemeProvider>
    );
    expect(screen.getByTestId("inner")).toHaveTextContent("Hello");
  });
});
