import type { SugarcubeConfig } from "../../src/types/config";

/**
 * Test configurations for unit tests.
 * These configs provide transform and output settings for tests that create tokens in memory.
 * For tests that load tokens from files, use resolver-based loading.
 */
export const configs = {
    basic: {
        output: {
            cssRoot: "src/css",
        },
    },

    themes: {
        output: {
            cssRoot: "src/css",
        },
    },

    fluid: {
        transforms: {
            fluid: {
                min: 320,
                max: 1200,
            },
        },
        output: {
            cssRoot: "src/css",
        },
    },

    colorsHex: {
        output: {
            cssRoot: "src/css",
        },
        transforms: {
            colorFallbackStrategy: "native",
        },
    },

    colorsRgb: {
        output: {
            cssRoot: "src/css",
        },
        transforms: {
            colorFallbackStrategy: "native",
        },
    },

    colorsHsl: {
        output: {
            cssRoot: "src/css",
        },
        transforms: {
            colorFallbackStrategy: "native",
        },
    },

    colorsP3: {
        output: {
            cssRoot: "src/css",
        },
        transforms: {
            colorFallbackStrategy: "native",
        },
    },

    edgeCases: {
        output: {
            cssRoot: "src/css",
        },
    },
} satisfies Record<string, SugarcubeConfig>;
