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
  // 与 log 一致：将 @lo/plugins-sdk / lo-plugins-sdk 映射到 lo-plugins-sdk 项目入口（供渲染进程之外的主进程模块使用）
  moduleNameMapper: {
    '^@lo/plugins-sdk$': '<rootDir>/../lo-plugins-sdk/src/index.cjs',
    '^lo-plugins-sdk$': '<rootDir>/../lo-plugins-sdk/src/index.cjs',
  },
};