module.exports = [
  ...require("@dho/eslint-config/base"),
  {
    ignores: ["generated/**"],
  },
  {
    files: ["prisma/seed.ts"],
    rules: {
      "no-console": "off",
    },
  },
];
