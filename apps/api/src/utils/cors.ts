/**
 * Parses the list of allowed CORS origins from the environment.
 *
 * - If CORS_ORIGINS is set, splits on commas and trims whitespace.
 * - In development / test (NODE_ENV !== "production"), falls back to localhost defaults.
 * - In production with no CORS_ORIGINS set, throws so the server refuses to start.
 */
export function parseAllowedOrigins(
  corsOriginsEnv: string | undefined,
  nodeEnv: string | undefined
): string[] {
  if (corsOriginsEnv && corsOriginsEnv.trim() !== "") {
    return corsOriginsEnv
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);
  }

  if (nodeEnv === "production") {
    throw new Error("CORS_ORIGINS must be set in production");
  }

  // development / test fallback
  return ["http://localhost:3000", "http://localhost:3001"];
}
