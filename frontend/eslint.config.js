import tseslint from "typescript-eslint"
import reactPlugin from "eslint-plugin-react"
import reactHooks from "eslint-plugin-react-hooks"
import jsxA11y from "eslint-plugin-jsx-a11y"
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended"

export default [
    {
        ignores: ["**/dist/**", "**/node_modules/**", "app/routeTree.gen.ts"],
    },
    {
        files: ["**/*.{ts,tsx}"],
        languageOptions: {
            parserOptions: {
                ecmaVersion: "latest",
                sourceType: "module",
                ecmaFeatures: { jsx: true },
            },
        },
        settings: {
            react: { version: "detect" },
        },
    },
    ...tseslint.configs.recommended,
    reactPlugin.configs.flat.recommended,
    reactPlugin.configs.flat["jsx-runtime"],
    jsxA11y.flatConfigs.recommended,
    {
        plugins: { "react-hooks": reactHooks },
        rules: {
            "react-hooks/rules-of-hooks": "error",
            "react-hooks/exhaustive-deps": "warn",
        },
    },
    {
        rules: {
            "react/react-in-jsx-scope": "off",
            "no-alert": "warn",
            "no-console": ["warn", { allow: ["warn", "error"] }],
        },
    },
    eslintPluginPrettierRecommended,
]
