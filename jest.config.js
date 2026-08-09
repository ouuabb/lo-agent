module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.test.cjs', '**/test/**/*.spec.cjs'],
  verbose: true,
  testTimeout: 30000,
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/test/',
    '/docs/',
    '/src/renderer/',
  ],
  moduleFileExtensions: ['cjs', 'js'],
  // 与 log 一致：将 @lo/sdk / lo-sdk 映射到 lo-sdk 项目入口（供渲染进程之外的主进程模块使用）
  moduleNameMapper: {
    '^@lo/sdk$': '<rootDir>/../lo-sdk/src/index.cjs',
    '^lo-sdk$': '<rootDir>/../lo-sdk/src/index.cjs',
  },
};