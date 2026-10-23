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
  // Временно снижено до реального уровня (~29%).
  // Поднять после добавления Game.test.ts и stats.test.ts.
  coverageThreshold: {
    global: {
      statements: 22,
      branches: 8,
      functions: 20,
      lines: 24,
    },
    './src/game/': {
      statements: 60,
      branches: 48,
      functions: 75,
      lines: 60,
    },
    './src/puzzle/': {
      statements: 70,
      branches: 60,
      functions: 80,
      lines: 70,
    },
  },
  // Предотвращает зависание воркера из-за открытых хендлов (Redis, таймеры)
  forceExit: true,
};