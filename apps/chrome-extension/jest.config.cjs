/** Scoped to phase4-launcher.test.ts only; every other test in this package runs under tsx --test (see package.json). */
module.exports = {
  testEnvironment: "jest-environment-jsdom",
  testEnvironmentOptions: {
    url: "https://web.whatsapp.com/",
  },
  testMatch: ["<rootDir>/tests/phase4-launcher.test.ts"],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: "<rootDir>/tsconfig.json",
        isolatedModules: true,
      },
    ],
  },
  moduleFileExtensions: ["ts", "js", "json"],
};
