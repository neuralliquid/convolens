// @ts-check
const path = require('path');

// Get base config if it exists
let baseConfig = {};
try {
  baseConfig = require('../../../jest.config.js');
  // If baseConfig is a function, call it
  if (typeof baseConfig === 'function') {
    baseConfig = baseConfig();
  }
  // If it returns a promise, we'll handle it synchronously for now
  if (baseConfig && typeof baseConfig.then === 'function') {
    console.warn('Asynchronous Jest config is not fully supported. Using empty config.');
    baseConfig = {};
  }
} catch (e) {
  // If base config doesn't exist, use empty object
  baseConfig = {};
}

/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  ...baseConfig,
  // Look for test files in the test directory
  testMatch: [
    '**/__tests__/**/*.[jt]s?(x)',
    '**/?(*.)+(spec|test).[tj]s?(x)',
    '**/tests/**/*.test.[jt]s?(x)'
  ],
  
  // Configure test results output
  testResultsProcessor: 'jest-junit',
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: path.join(process.cwd(), 'tests', '__results__', 'junit'),
      outputName: 'junit.xml',
      ancestorSeparator: ' › ',
      uniqueOutputName: 'false',
      suiteNameTemplate: '{filepath}'
    }]
  ],
  
  // Add any test-specific setup
  setupFilesAfterEnv: [
    ...(Array.isArray(baseConfig.setupFilesAfterEnv) ? baseConfig.setupFilesAfterEnv : []),
    path.join(process.cwd(), 'tests', 'setupTests.ts'),
  ],
  
  // Ensure test files are properly transformed
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: path.join(process.cwd(), 'tsconfig.json'),
      },
    ],
  },
  
  // Module name mapper for path aliases
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/apps/web/src/$1',
    '^@/tests/(.*)$': '<rootDir>/tests/$1',
  },
  
  // Test environment
  testEnvironment: 'jsdom',
  
  // Coverage configuration
  collectCoverage: false,
  coverageDirectory: path.join(process.cwd(), 'tests', '__results__', 'coverage'),
  coverageReporters: ['json', 'lcov', 'text', 'clover'],
  
  // Watch plugins
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname',
  ],
};
