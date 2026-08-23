import type { PanelSource } from "../types/config.js";

type AliasOptions = string | Record<string, string>;

/** The two fields a section can supply on behalf of its alias bindings. */
type PanelDefaults = {
    from?: PanelSource;
    options?: AliasOptions;
};

/**
 * Resolves an alias binding's source against its section's defaults.
 *
 * Deliberately returns whatever it finds, including `undefined`: the schema uses that to
 * report exactly what's missing, and the studio calls the same function so the two can't
 * drift apart on what "inherited" means.
 *
 * Nothing here infers a source from a token's `$type` or its value shape. A binding that
 * declares neither, in a section that declares neither, is a config error — as is one that
 * declares both.
 */
export function resolvePanelDefaults(
    section: PanelDefaults,
    binding: PanelDefaults,
): PanelDefaults {
    return {
        from: binding.from ?? section.from,
        options: binding.options ?? section.options,
    };
}

/**
 * `from` and `options` are alternatives, not a pair: one names a source declared elsewhere
 * in config, the other is the set itself. Exactly one has to resolve.
 */
export function panelSourceIssue(
    resolved: PanelDefaults,
): "missing" | "ambiguous" | undefined {
    const hasFrom = resolved.from !== undefined;
    const hasOptions = resolved.options !== undefined;

    if (hasFrom && hasOptions) return "ambiguous";
    if (!hasFrom && !hasOptions) return "missing";
    return undefined;
}

export type { AliasOptions, PanelDefaults };
