module.exports = {
  root: true,
  extends: ['../config/eslint.base.js', 'plugin:react-hooks/recommended'],
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaFeatures: { jsx: true } },
  plugins: ['@typescript-eslint'],
  env: { browser: true },
  rules: {
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    // TypeScript itself catches genuine undefined-variable errors; `no-undef`
    // only produces false positives here for vitest globals (describe/it/vi/...)
    // and the JSX runtime's implicit `React` reference.
    'no-undef': 'off',
  },
  ignorePatterns: ['dist/**'],
};
