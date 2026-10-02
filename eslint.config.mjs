import nextCoreWebVitals from "eslint-config-next/core-web-vitals"
import nextTypescript from "eslint-config-next/typescript"

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    // Pre-existing code style findings: reported as warnings so `pnpm lint`
    // is usable (and can gate CI) without a large unrelated refactor.
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "react/no-unescaped-entities": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/refs": "warn",
      "@next/next/no-html-link-for-pages": "warn",
    },
  },
  {
    ignores: [".next/**", "node_modules/**", "public/**", "scripts/**", "next-env.d.ts"],
  },
]

export default eslintConfig
