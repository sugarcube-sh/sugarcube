import type { SugarcubeConfig } from "../../src/types/config";

/**
 * Test configurations for unit tests.
 * These configs provide transform and output settings for tests that create tokens in memory.
 * For tests that load tokens from files, use resolver-based loading.
 */
export const configs = {
    basic: {
        variables: {
            path: "src/css/tokens.css",
        },
    },

    themes: {
        variables: {
            path: "src/css/tokens.css",
        },
    },

    fluid: {
        variables: {
            path: "src/css/tokens.css",
            transforms: {
                fluid: {
                    min: 320,
                    max: 1200,
                },
            },
        },
    },

    colorsHex: {
        variables: {
            path: "src/css/tokens.css",
            transforms: {
                colorFallbackStrategy: "native",
            },
        },
    },

    colorsRgb: {
        variables: {
            path: "src/css/tokens.css",
            transforms: {
                colorFallbackStrategy: "native",
            },
        },
    },

    colorsHsl: {
        variables: {
            path: "src/css/tokens.css",
            transforms: {
                colorFallbackStrategy: "native",
            },
        },
    },

    colorsP3: {
        variables: {
            path: "src/css/tokens.css",
            transforms: {
                colorFallbackStrategy: "native",
            },
        },
    },

    edgeCases: {
        variables: {
            path: "src/css/tokens.css",
        },
    },
} satisfies Record<string, SugarcubeConfig>;
