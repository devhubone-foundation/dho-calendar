const { FlatCompat } = require("@eslint/eslintrc");
const base = require("./base");

const compat = new FlatCompat({ baseDirectory: __dirname });

/** @type {import("eslint").Linter.Config[]} */
module.exports = [
  { ignores: ["**/next-env.d.ts"] },
  // next/core-web-vitals first: `base` (spread after) re-applies our
  // TypeScript parser/rules so they aren't clobbered by Next's config.
  ...compat.extends("next/core-web-vitals"),
  ...base,
  {
    rules: {
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
    },
  },
];
