import baseConfig from "@tb/eslint-config/base";

export default [
  ...baseConfig,
  { ignores: ["**/next-env.d.ts"] },
];
