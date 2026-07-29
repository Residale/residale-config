import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", ".output", ".vinxi"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
          ],
        },
      ],
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  eslintPluginPrettier,
  {
    // residale-shared-session.ts is a byte-identical canonical copy shared
    // across residale-crm/residale-files/residale-config (DESIGN.md D13;
    // README-CANONICAL.md: "Keep LOGIC byte-identical"). It pre-emptively
    // disables no-console around its two console.warn/console.error calls
    // (T15 chunk-count warnings) and keeps two lines over this repo's
    // 100-char printWidth to stay identical to the other two copies.
    // Neither issue is a real problem here — this repo doesn't enable
    // no-console either — so both checks are scoped off for this one file
    // rather than reformatting the shared source (which the static drift-
    // detector tests compare byte-for-byte against the canonical original).
    files: ["src/lib/residale-shared-session.ts"],
    rules: {
      "prettier/prettier": "off",
    },
    linterOptions: {
      reportUnusedDisableDirectives: false,
    },
  },
  {
    // ResidaleAppSwitcher.tsx: same byte-identical-copy rationale as above —
    // two lines exceed printWidth (kept identical to the CRM/Files copies)
    // and it exports RESIDALE_APPS (an array, not a primitive) alongside the
    // component, which allowConstantExport does not exempt.
    files: ["src/components/residale/**/*.{ts,tsx}"],
    rules: {
      "prettier/prettier": "off",
      "react-refresh/only-export-components": "off",
    },
  },
);
