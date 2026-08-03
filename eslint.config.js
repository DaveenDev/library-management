import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/node_modules/**", "**/*.tsbuildinfo", "client/dist/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Unused vars are errors, but an underscore prefix marks a deliberate
      // discard (unused express `next`, destructured-and-dropped fields).
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      // Non-null assertions are used where a zod refinement has already proven
      // the value is present but TypeScript cannot see it.
      "@typescript-eslint/no-non-null-assertion": "off",
      "no-console": ["warn", { allow: ["warn", "error", "info", "log"] }],
      eqeqeq: ["error", "smart"],
      "prefer-const": "error",
      "no-var": "error",
    },
  },
  {
    files: ["client/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    languageOptions: {
      globals: {
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        confirm: "readonly",
        alert: "readonly",
        URL: "readonly",
        Blob: "readonly",
        HTMLInputElement: "readonly",
        HTMLSelectElement: "readonly",
        HTMLElement: "readonly",
        KeyboardEvent: "readonly",
        Event: "readonly",
        fetch: "readonly",
        RequestInit: "readonly",
        localStorage: "readonly",
      },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // KNOWN FOLLOW-UP: several pages seed form state from a fetched value
      // inside an effect (Settings, Catalog, Borrowers). The correct fix is to
      // derive the state or key the component on the loaded data rather than
      // syncing it. Left as a warning so it stays visible without blocking CI
      // on a pre-existing pattern.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  {
    files: ["server/**/*.ts"],
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        URL: "readonly",
      },
    },
  },
  prettier,
);
