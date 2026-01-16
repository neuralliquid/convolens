import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import type { Linter } from 'eslint';

// Base config shared by all
export const baseConfig: Linter.FlatConfig[] = tseslint.config(
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**'],
  },
) as unknown as Linter.FlatConfig[];

// Node.js config
export const nodeConfig: Linter.FlatConfig[] = tseslint.config(
  ...baseConfig,
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020 as const,
      sourceType: 'module' as const,
      globals: {
        ...globals.node,
      },
    },
  },
) as unknown as Linter.FlatConfig[];

// React config generator
export const reactConfig = (_options: { strict?: boolean } = {}): Linter.FlatConfig[] => {
  const configs = tseslint.config(
    ...baseConfig,
    {
      files: ['**/*.{jsx,tsx}'],
      settings: {
        react: {
          version: 'detect',
        },
      },
      languageOptions: {
        ecmaVersion: 2020 as const,
        sourceType: 'module' as const,
        globals: {
          ...globals.browser,
        },
        parserOptions: {
          ecmaFeatures: {
            jsx: true,
          },
        },
      },
      rules: {
        'react/prop-types': 'off',
        'react/react-in-jsx-scope': 'off',
      },
    }
  );

  return configs as unknown as Linter.FlatConfig[];
};

// Typescript specific config
export const typescriptConfig: Linter.FlatConfig[] = tseslint.config(
  ...baseConfig,
  ...tseslint.configs.recommended,
  ...tseslint.configs.stylistic,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
      },
    },
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
) as unknown as Linter.FlatConfig[];

export const prettierConfig = {
  rules: {
    'prettier/prettier': 'error',
  },
};

// Default export combining everything
export default tseslint.config(
  js.configs.recommended,
  ...typescriptConfig,
) as unknown as Linter.FlatConfig[];
