import { assignCSSNames, generateCSSVariables, groupByContext } from "@sugarcube-sh/core";
import type { InternalConfig } from "@sugarcube-sh/core";
import postcss from "postcss";
import { prepareTokens } from "../prepare-tokens.js";

/**
 * The set of CSS custom-property names sugarcube generates for a project,
 * e.g. `--color-primary`. Names include the leading `--` so they compare
 * directly against `var(--…)` references.
 *
 * We run the real variable pipeline and read the declarations straight out of
 * the CSS it would emit, rather than re-deriving names from token paths. That
 * way typography sub-properties (`--text-base-font-family`), the configured
 * prefix/delimiter, the `$root` rule and every permutation are already baked
 * in — the output is the source of truth, so the lint can't disagree with it.
 *
 * This is authoritative even before the user re-runs `generate`: it reflects
 * the current config, not whatever stale file is on disk.
 */
export async function getGeneratedVarNames(config: InternalConfig): Promise<Set<string>> {
    const { trees, resolved, permutations } = await prepareTokens(config);
    const convertedTokens = assignCSSNames(groupByContext(trees, resolved), config);
    const output = await generateCSSVariables(convertedTokens, config, permutations);

    const names = new Set<string>();
    for (const file of output) {
        postcss.parse(file.css).walkDecls((decl) => {
            if (decl.prop.startsWith("--")) {
                names.add(decl.prop);
            }
        });
    }
    return names;
}
