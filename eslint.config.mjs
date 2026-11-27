import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Third-party registry code (Watermelon, Sora) is kept as published so updates stay diffable.
  // React Compiler rules still report there, as warnings instead of errors.
  {
    files: [
      "src/components/ui/sidebar.tsx",
      "src/components/watermelon-ui/**",
      "src/components/sora-ui/**",
    ],
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
