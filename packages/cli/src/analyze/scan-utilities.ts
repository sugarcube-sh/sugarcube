import {
    type InternalConfig,
    type NormalizedRenderableTokens,
    convertConfigToUnoRules,
    enumerateSafelistClasses,
} from "@sugarcube-sh/core";
import { createGenerator } from "@unocss/core";
import { type VarRef, scanCSS } from "../lint/scan-css.js";
import { getMarkupFiles, readMarkupSources } from "../scan-markup.js";

// This is just a stand-in filename for references that came from generated utilities rather than a real file.
export const UTILITY_SOURCE = "<utilities>";

export interface UtilityUsage {
    refs: VarRef[];
    fileCount: number;
}

/**
 * Find tokens used through utility classes, not just `var()` in your CSS.
 *
 * A class like `p-sm` only pulls in a token once UnoCSS generates the utility —
 * you won't see that reference in anything you wrote. So we run the same utility
 * rules the real build uses, scan your markup (plus the safelist), and collect
 * the `var(--…)` names from the CSS UnoCSS produces. That way "used" means the
 * same thing here as it does when you ship.
 */
export async function scanUtilityUsage(
    config: InternalConfig,
    tokens: NormalizedRenderableTokens,
    paths: string[] = [],
): Promise<UtilityUsage> {
    const classes = config.utilities?.classes ?? {};
    const rules = convertConfigToUnoRules(classes, tokens);
    if (rules.length === 0) return { refs: [], fileCount: 0 };

    // Same options the generation path builds (`buildUtilityGenerator`), so this
    // reproduces the real build rather than an approximation of it.
    const safelist = enumerateSafelistClasses(classes, tokens);

    // Same discovery `generate` uses, so "used" here means the same thing it
    // means at build time
    const files = (await getMarkupFiles(paths.length > 0 ? paths : config.content)).sort();
    if (files.length === 0 && safelist.length === 0) return { refs: [], fileCount: 0 };

    const generator = await createGenerator({ rules, safelist });
    const sources = await readMarkupSources(files);
    const { css } = await generator.generate(sources.join("\n"));

    return { refs: css ? scanCSS(css, UTILITY_SOURCE).used : [], fileCount: files.length };
}
