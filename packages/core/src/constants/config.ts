export const DEFAULT_CONFIG = {
    variables: {
        filename: "variables.gen.css",
        transforms: {
            fluid: {
                min: 320,
                max: 1200,
            },
            colorFallbackStrategy: "native" as const,
        },
    },
    utilities: {
        filename: "utilities.gen.css",
    },
} as const;
