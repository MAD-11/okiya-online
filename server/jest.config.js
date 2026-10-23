module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
    '!src/logger.ts',
  ],
  coverageThreshold: {
    global: {
      statements: 55,
      branches: 45,
      functions: 55,
      lines: 55,
    },
    './src/game/': {
      statements: 80,
      branches: 70,
      functions: 80,
      lines: 80,
    },
  },
};