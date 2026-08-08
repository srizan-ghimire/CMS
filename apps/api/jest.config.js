/** @type {import('jest').Config} */
module.exports = {
  rootDir: ".",
  testEnvironment: "node",
  moduleFileExtensions: ["js", "json", "ts"],
  testRegex: ".*\.spec\.ts$",
  transform: { "^.+\.ts$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.json", isolatedModules: true }] },
  collectCoverageFrom: ["src/**/*.ts", "!src/main.ts", "!src/**/*.module.ts"],
  coverageDirectory: "coverage",
  // packages/shared is consumed as built CJS; map it so tests don't need a prior build step.
  moduleNameMapper: { "^@social-platform/shared$": "<rootDir>/../../packages/shared/src/index.ts" },
};
