// @ts-check
const nextJest = require('next/jest').default;

const createJestConfig = nextJest({
  // Path to your Next.js app
  dir: './',
});

// Custom configuration to be passed to Jest
const customJestConfig = {
  // The root of your source code
  rootDir: '../../',
  roots: ['<rootDir>/apps/web/src', '<rootDir>/tests'],
  
  // Test environment
  testEnvironment: 'jsdom',
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/apps/web/jest.setup.js'],
  
  // Module paths
  moduleDirectories: ['node_modules', '<rootDir>/apps/web/node_modules'],
  
  // Module name mapping - must match your tsconfig.json paths
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/apps/web/src/$1',
    '^@whatssummarize/ui$': '<rootDir>/packages/ui/src/index.ts',
    '^@whatssummarize/ui/(.*)$': '<rootDir>/packages/ui/src/$1',
    '^@whatssummarize/utils$': '<rootDir>/packages/utils/src/index.ts',
    '^@whatssummarize/utils/(.*)$': '<rootDir>/packages/utils/src/$1',
    '^@whatssummarize/contexts$': '<rootDir>/packages/contexts/src/index.ts',
    '^@whatssummarize/contexts/(.*)$': '<rootDir>/packages/contexts/src/$1',
    '^@ui/(.*)$': '<rootDir>/apps/web/src/components/$1',
    '^@utils/(.*)$': '<rootDir>/apps/web/src/lib/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  
  // Test path patterns to ignore
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
    '<rootDir>/cypress/'
  ],
  
  // Transform settings
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
  },
  
  // Module transformation ignore patterns
  transformIgnorePatterns: [
    'node_modules/(?!(date-fns|@babel/runtime|@babel/preset-env|@babel/plugin-transform-runtime)/)',
  ],
  
  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)',
  ],
  
  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
};

// Create and export the final config
module.exports = createJestConfig(customJestConfig);
