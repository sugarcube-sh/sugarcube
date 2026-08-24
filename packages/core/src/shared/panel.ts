import type { PanelSource } from "../types/config.js";

type AliasOptions = string | Record<string, string>;

type PanelDefaults = {
    from?: PanelSource;
    options?: AliasOptions;
};

/**
 * Where do this row's choices come from - the binding, or its section?
 *
 * Alias bindings can declare their own `from`/`options`, or inherit them from the
 * section so a shared set isn't repeated. Config validation and the studio both call
 * this so they never disagree about which one won.
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
 * An alias row needs exactly one way to get its choices: either `from` or `options`.
 * Returns what went wrong when that isn't true.
 */
export function panelSourceIssue(resolved: PanelDefaults): "missing" | "ambiguous" | undefined {
    const hasFrom = resolved.from !== undefined;
    const hasOptions = resolved.options !== undefined;

    if (hasFrom && hasOptions) return "ambiguous";
    if (!hasFrom && !hasOptions) return "missing";
    return undefined;
}

export type { AliasOptions, PanelDefaults };
