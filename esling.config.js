export default [
  { ignores: ["dist/**", "node_modules/**"] },
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: { ecmaVersion: "latest", sourceType: "module" },
  },
];