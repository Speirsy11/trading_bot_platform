export type StrategyParamInputType = "number" | "boolean" | "select" | "text";

export type StrategyParamDefinition = {
  name: string;
  type?: unknown;
  inputType?: StrategyParamInputType | string | null;
  defaultValue?: unknown;
  options?: string[] | null;
  description?: string | null;
  min?: number | null;
  max?: number | null;
  integer?: boolean | null;
};

export type StrategyParams = Record<string, unknown>;

export function getDefaultStrategyParams(
  params: readonly StrategyParamDefinition[] | undefined
): StrategyParams {
  return Object.fromEntries(
    (params ?? [])
      .map((param) => [param.name, param.defaultValue])
      .filter(([, value]) => value !== undefined)
  );
}

export function mergeStrategyParamValue(
  current: StrategyParams | undefined,
  name: string,
  value: unknown
) {
  const next = { ...(current ?? {}) };
  if (value === undefined || value === "") {
    delete next[name];
  } else {
    next[name] = value;
  }
  return next;
}

export function isNumberStrategyParam(param: StrategyParamDefinition, value?: unknown) {
  return (
    param.inputType === "number" ||
    typeof value === "number" ||
    typeof param.defaultValue === "number"
  );
}

export function coerceStrategyParamInput(param: StrategyParamDefinition, value: string) {
  if (value === "") return undefined;
  if (isNumberStrategyParam(param)) {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : undefined;
  }
  return value;
}

export function formatStrategyParamLabel(name: string) {
  return name
    .replace(/([A-Z])/g, " $1")
    .trim()
    .split(/\s+/)
    .map((word) => {
      const upperWord = word.toUpperCase();
      if (["ATR", "EMA", "RSI", "SMA"].includes(upperWord)) return upperWord;
      return word.replace(/^./, (char) => char.toUpperCase());
    })
    .join(" ");
}

export function formatStrategyParamType(param: StrategyParamDefinition) {
  if (param.inputType) return param.inputType;
  return String(param.type ?? "param")
    .replace("Zod", "")
    .toLowerCase();
}
