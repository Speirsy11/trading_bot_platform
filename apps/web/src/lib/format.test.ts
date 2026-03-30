import { describe, it, expect } from "vitest";

import {
  formatCurrency,
  formatCompact,
  formatPercent,
  formatNumber,
  formatDate,
  formatDateShort,
  pnlColor,
  pnlClass,
} from "@/lib/format";

describe("formatCurrency", () => {
  it("formats positive values", () => {
    expect(formatCurrency(1234.56)).toBe("$1,234.56");
  });

  it("formats zero", () => {
    expect(formatCurrency(0)).toBe("$0.00");
  });

  it("formats negative values", () => {
    expect(formatCurrency(-500)).toBe("-$500.00");
  });

  it("respects custom decimals", () => {
    expect(formatCurrency(10, 0)).toBe("$10");
  });
});

describe("formatCompact", () => {
  it("compacts thousands", () => {
    expect(formatCompact(1500)).toBe("1.5K");
  });

  it("compacts millions", () => {
    expect(formatCompact(2_500_000)).toBe("2.5M");
  });
});

describe("formatPercent", () => {
  it("adds + prefix for positive", () => {
    expect(formatPercent(5.5)).toBe("+5.50%");
  });

  it("keeps - prefix for negative", () => {
    expect(formatPercent(-3.2)).toBe("-3.20%");
  });

  it("treats zero as non-negative", () => {
    expect(formatPercent(0)).toBe("+0.00%");
  });
});

describe("formatNumber", () => {
  it("formats with grouping", () => {
    expect(formatNumber(1234567.89)).toBe("1,234,567.89");
  });

  it("respects custom decimals", () => {
    expect(formatNumber(10.5, 0)).toBe("11");
  });
});

describe("formatDate", () => {
  it("formats ISO string", () => {
    const result = formatDate("2024-06-15T14:30:00Z");
    expect(result).toMatch(/Jun 15, 2024/);
  });

  it("formats Date object", () => {
    const date = new Date("2024-01-01T12:00:00Z");
    expect(formatDate(date)).toBe(formatDate("2024-01-01T12:00:00Z"));
  });
});

describe("formatDateShort", () => {
  it("formats shorter date", () => {
    const result = formatDateShort("2024-06-15T14:30:00Z");
    expect(result).toMatch(/Jun 15/);
  });
});

describe("pnlColor", () => {
  it("returns profit color for positive", () => {
    expect(pnlColor(100)).toBe("var(--profit)");
  });

  it("returns loss color for negative", () => {
    expect(pnlColor(-50)).toBe("var(--loss)");
  });

  it("returns muted for zero", () => {
    expect(pnlColor(0)).toBe("var(--text-muted)");
  });
});

describe("pnlClass", () => {
  it("returns text-profit for positive", () => {
    expect(pnlClass(1)).toBe("text-profit");
  });

  it("returns text-loss for negative", () => {
    expect(pnlClass(-1)).toBe("text-loss");
  });

  it("returns empty for zero", () => {
    expect(pnlClass(0)).toBe("");
  });
});
