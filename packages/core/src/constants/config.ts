export const DEFAULT_CONFIG = {
    output: {
        cssRoot: "src/styles",
        variablesFilename: "tokens.variables.gen.css",
        utilitiesFilename: "utilities.gen.css",
        components: "src/components/ui",
        themeAttribute: "data-theme",
    },
    transforms: {
        fluid: {
            min: 320,
            max: 1200,
        },
        colorFallbackStrategy: "native" as const,
    },
} as const;
