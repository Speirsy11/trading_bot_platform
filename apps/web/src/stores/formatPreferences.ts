import { create } from "zustand";
import { persist } from "zustand/middleware";

export type DisplayCurrency = "USD" | "EUR" | "GBP" | "BTC";
export type DecimalPlaces = 2 | 4 | 6 | 8;

interface FormatPreferencesState {
  currency: DisplayCurrency;
  decimalPlaces: DecimalPlaces;
  setCurrency: (currency: DisplayCurrency) => void;
  setDecimalPlaces: (decimals: DecimalPlaces) => void;
}

export const useFormatPreferences = create<FormatPreferencesState>()(
  persist(
    (set) => ({
      currency: "USD",
      decimalPlaces: 2,
      setCurrency: (currency) => set({ currency }),
      setDecimalPlaces: (decimalPlaces) => set({ decimalPlaces }),
    }),
    {
      name: "tb-format-preferences",
    }
  )
);
