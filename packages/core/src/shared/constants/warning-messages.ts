export const WarningMessages = {
    VALIDATE: {
        DEPRECATED_FLUID_DIMENSION: (path: string) =>
            `$type: "fluidDimension" is deprecated at "${path}". Use $type: "dimension" with $extensions["sh.sugarcube"].fluid instead.`,
    },
    FLATTEN: {
        WHITESPACE_IN_NAME: (name: string) =>
            `Token name "${name}" has leading or trailing whitespace. This was likely a typo; sugarcube will trim it when generating CSS variable names, but you should fix the source.`,
    },
    RESOLVER: {
        PREFERS_COLOR_SCHEME_DEPRECATED: (name: string) =>
            `Modifier "${name}" uses the deprecated prefersColorScheme extension. Use variables.permutations with atRule instead. See https://sugarcube.sh/docs/theming`,
        PREFERS_COLOR_SCHEME_INVALID_CONTEXTS: (name: string, invalidContexts: string[]) =>
            `Modifier "${name}" uses prefersColorScheme but has invalid contexts: ${invalidContexts.join(", ")}. Only "light" and "dark" are supported.`,
        PREFERS_COLOR_SCHEME_EMPTY_NON_DEFAULT: (name: string, emptyContext: string) =>
            `Modifier "${name}" uses prefersColorScheme but the "${emptyContext}" context has no sources. Since "${emptyContext}" is not the default, it needs token sources to generate the @media (prefers-color-scheme: ${emptyContext}) rule.`,
    },
} as const;
