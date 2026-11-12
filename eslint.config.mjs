import eslint from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["**/.next/**", "**/dist/**", "**/node_modules/**", "**/.vercel/**", "**/coverage/**"],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs,ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-useless-escape": "off",
      "no-useless-assignment": "off",
      "prefer-const": "off",
    },
  },
  {
    files: [
      "apps/web/src/**/*.{js,mjs,cjs,ts,tsx}",
      "apps/web/lib/**/*.{js,mjs,cjs,ts,tsx}",
      "apps/web/app/**/*.{js,mjs,cjs,ts,tsx}",
      "apps/web/components/**/*.{js,mjs,cjs,ts,tsx}",
    ],
    ignores: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}", "**/test/**", "**/__tests__/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "**/fixtures/**",
                "**/mocks/**",
                "*mock*",
                "*fixture*",
                "**/workspace-defaults*",
                "*workspace-defaults*",
              ],
              message:
                "Imports from fixtures, mocks, or workspace-defaults are banned. Use real backend API clients and mappers.",
            },
          ],
        },
      ],
    },
  },
);
