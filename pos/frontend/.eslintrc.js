module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    node: true
  },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended'
  ],
  parserOptions: {
    ecmaFeatures: {
      jsx: true
    },
    ecmaVersion: 12,
    sourceType: 'module'
  },
  plugins: [
    'react'
  ],
  rules: {
    // Disable TypeScript specific rules for JSX files
    '@typescript-eslint/no-implicit-any': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    'react/prop-types': 'off'
  },
  settings: {
    react: {
      version: 'detect'
    }
  },
  overrides: [
    {
      files: ['*.jsx'],
      rules: {
        // Disable TypeScript specific rules for JSX files
        '@typescript-eslint/no-implicit-any': 'off',
        '@typescript-eslint/explicit-module-boundary-types': 'off'
      }
    }
  ]
}
