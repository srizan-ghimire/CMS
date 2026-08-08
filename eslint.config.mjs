import js from "@eslint/js";
import tseslint from "typescript-eslint";
import nextPlugin from "@next/eslint-plugin-next";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ["**/dist/**", "**/.next/**", "**/node_modules/**", "**/coverage/**"]
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": "error",
      "no-console": ["warn", { allow: ["warn", "error"] }]
    }
  },
  {
    // NestJS resolves constructor injection from `design:paramtypes`, which `emitDecoratorMetadata`
    // can only emit if the injected class is a *value* import. `consistent-type-imports` rewrites
    // `import { PrismaService }` to `import type { PrismaService }`, erasing the binding — the code
    // still type-checks and still builds, then fails at boot with "Nest can't resolve dependencies".
    // The rule is fundamentally incompatible with decorator-based DI, so it is off for the API.
    files: ["apps/api/**/*.ts"],
    rules: {
      "@typescript-eslint/consistent-type-imports": "off"
    }
  },
  {
    // Next runs ESLint against this same flat config during `next build`, so its rules have to be
    // registered here — otherwise an inline `eslint-disable @next/next/...` comment in apps/web
    // fails the build with "Definition for rule was not found".
    files: ["apps/web/**/*.{ts,tsx}"],
    plugins: { "@next/next": nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules
    }
  }
);
