import root from "../../eslint.config.mjs";

export default [
  ...root,
  {
    files: ["**/*.tsx", "**/*.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          // useEffect(() => el.scrollIntoView()) returns a Promise in newer Chromium,
          // and React crashes when an effect returns anything but a cleanup function.
          selector: "CallExpression[callee.name=/^use(Layout|Insertion)?Effect$/] > ArrowFunctionExpression[expression=true]",
          message: "Give effect callbacks a block body ({ ... }) so they can't accidentally return a value.",
        },
      ],
    },
  },
];
