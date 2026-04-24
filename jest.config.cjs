/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/server.test.cjs'],
  transform: {},
  coverageDirectory: 'coverage',
  verbose: true,
  testTimeout: 15000,
};
