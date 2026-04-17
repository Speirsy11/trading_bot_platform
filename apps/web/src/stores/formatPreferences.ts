import { create } from "zustand";
import { persist } from "zustand/middleware";

export type DisplayCurrency = "USD" | "EUR" | "GBP" | "BTC";
export type DecimalPlaces = 2 | 4 | 6 | 8;

interface FormatPreferencesState {
  currency: DisplayCurrency;
  decimalPlaces: DecimalPlaces;
  timezone: string;
  setCurrency: (currency: DisplayCurrency) => void;
  setDecimalPlaces: (decimals: DecimalPlaces) => void;
  setTimezone: (timezone: string) => void;
}

export const useFormatPreferences = create<FormatPreferencesState>()(
  persist(
    (set) => ({
      currency: "USD",
      decimalPlaces: 2,
      timezone: "UTC",
      setCurrency: (currency) => set({ currency }),
      setDecimalPlaces: (decimalPlaces) => set({ decimalPlaces }),
      setTimezone: (timezone) => set({ timezone }),
    }),
    {
      name: "tb-format-preferences",
    }
  )
);
