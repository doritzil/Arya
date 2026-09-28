/** Root Jest: the app (jest-expo) and the pure score engine (ts-jest). `pnpm test` runs both. */
module.exports = {
  projects: [
    {
      displayName: 'app',
      preset: 'jest-expo',
      roots: ['<rootDir>/src', '<rootDir>/modules'],
      testMatch: ['**/*.test.ts', '**/*.test.tsx'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@modules/(.*)$': '<rootDir>/modules/$1',
      },
    },
    '<rootDir>/packages/score-engine',
  ],
};
