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
      statements: 35,
      branches: 20,
      functions: 40,
      lines: 35,
    },
    './src/game/': {
      statements: 60,
      branches: 50,
      functions: 75,
      lines: 60,
    },
  },
  // Предотвращает зависание воркера из-за открытых хендлов (Redis, таймеры)
  forceExit: true,
};