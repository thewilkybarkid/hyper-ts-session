module.exports = {
  injectGlobals: false,
  testEnvironment: 'node',
  roots: ['./src/', './test/'],
  moduleFileExtensions: ['ts', 'js'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        diagnostics: false,
        isolatedModules: true,
      },
    ],
  },
}
