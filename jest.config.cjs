/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  roots: ["<rootDir>/tests"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  moduleNameMapper: {
    "^@/app/(.*)$": "<rootDir>/src/app/$1",
    "^@/components/(.*)$": "<rootDir>/src/components/$1",
    "^@/lib/(.*)$": "<rootDir>/src/lib/$1",
    "^@/stores/(.*)$": "<rootDir>/src/stores/$1",
    "^@/types/(.*)$": "<rootDir>/src/types/$1",
  },
  setupFilesAfterEnv: ["<rootDir>/tests/setupTests.ts"],
};

