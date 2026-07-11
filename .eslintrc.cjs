module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    webextensions: true
  },
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  rules: {
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
  },
  ignorePatterns: ['dist/', 'node_modules/'],
  overrides: [
    {
      files: ['build.js', 'jest.config.cjs', 'playwright.config.js', 'tests/**/*.js'],
      env: {
        node: true,
        jest: true
      },
      parserOptions: {
        sourceType: 'script'
      }
    }
  ]
};
