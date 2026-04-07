import nx from "@nx/eslint-plugin"
import stylistic from "@stylistic/eslint-plugin"

export default [
    ...nx.configs["flat/base"],
    ...nx.configs["flat/typescript"],
    ...nx.configs["flat/javascript"],
    {
        plugins: {
            "@stylistic": stylistic,
        },
        rules: {
            "linebreak-style": ["error", "unix"],
            "@stylistic/indent": ["warn", 4],
            "@stylistic/block-spacing": "warn",
            "keyword-spacing": "warn",
            "@stylistic/padding-line-between-statements": [
                "warn",
                { blankLine: "always", prev: "block-like", next: "const" },
                { blankLine: "always", prev: "block-like", next: "let" },
                { blankLine: "always", prev: "block-like", next: "return" },
                { blankLine: "always", prev: "block-like", next: "throw" },
                { blankLine: "always", prev: "block-like", next: "function" },
                { blankLine: "always", prev: "block-like", next: "class" },
                { blankLine: "always", prev: "block-like", next: "expression" },

                { blankLine: "always", prev: "block-like", next: "block-like" },
                { blankLine: "always", prev: "const", next: "block-like" },
                { blankLine: "always", prev: "let", next: "block-like" },
                { blankLine: "always", prev: "expression", next: "block-like" },
            ],
        },
    },
    {
        ignores: ["**/dist", "**/out-tsc", "**/vite.config.*.timestamp*"],
    },
    {
        files: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
        rules: {
            "@nx/enforce-module-boundaries": [
                "error",
                {
                    enforceBuildableLibDependency: true,
                    allow: ["^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$"],
                    depConstraints: [
                        {
                            sourceTag: "*",
                            onlyDependOnLibsWithTags: ["*"],
                        },
                    ],
                },
            ],
        },
    },
    {
        files: [
            "**/*.ts",
            "**/*.tsx",
            "**/*.cts",
            "**/*.mts",
            "**/*.js",
            "**/*.jsx",
            "**/*.cjs",
            "**/*.mjs",
        ],
        // Override or add rules here
        rules: {},
    },
]
