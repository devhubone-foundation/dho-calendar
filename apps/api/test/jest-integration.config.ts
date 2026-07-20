import type { Config } from "jest";

const config: Config = {
  rootDir: "..",
  testEnvironment: "node",
  moduleFileExtensions: ["js", "json", "ts"],
  testRegex: "test/integration/.*\\.integration-spec\\.ts$",
  transform: {
    "^.+\\.(t|j)s$": ["ts-jest", { tsconfig: "tsconfig.json" }],
  },
  setupFilesAfterEnv: ["<rootDir>/test/integration/jest.setup.ts"],
  testTimeout: 20000,
  passWithNoTests: true,
};

export default config;
