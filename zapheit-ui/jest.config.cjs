module.exports = {
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.jest.json' }],
  },
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts?(x)', '**/?(*.)+(spec|test).ts?(x)'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    // analytics.ts uses import.meta.env (Vite-only) — stub in Jest
    'lib/analytics': '<rootDir>/src/__mocks__/analytics.ts',
    'posthog-js': '<rootDir>/src/__mocks__/posthog-js.ts',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    // Vite-only files that use import.meta and cannot be instrumented by Jest/Istanbul
    '!src/lib/analytics.ts',
  ],
};
