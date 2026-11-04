// ESLint flat config. eslint-config-next v16 exports native flat configs,
// so no @eslint/eslintrc FlatCompat shim is needed (ESLint 10 removed it).
import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "public/**",
      "next-env.d.ts",
      "internal-docs/**",
    ],
  },
  ...coreWebVitals,
  ...typescript,
  {
    rules: {
      // Downgraded to warnings, honestly: ~135 pre-existing `any`s across
      // admin/export/router files (the same debt behind the former
      // typescript.ignoreBuildErrors override) and the React-Compiler-era
      // react-hooks v6 rules the codebase has not been migrated to yet.
      // They stay visible in every lint run; new code should not add to
      // them. Tightening these back to errors is tracked cleanup.
      "@typescript-eslint/no-explicit-any": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
    },
  },
];

export default eslintConfig;
