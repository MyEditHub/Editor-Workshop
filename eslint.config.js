import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      // Warn on unused variables (except those starting with _)
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Allow explicit any in some cases (warn instead of error)
      "@typescript-eslint/no-explicit-any": "warn",
      // Prefer const
      "prefer-const": "warn",
      // No console in production (warn only)
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  {
    ignores: ["dist/**", "node_modules/**", "src-tauri/**"],
  }
);
