import {
    type InternalConfig,
    type NormalizedRenderableTokens,
    type TokenGraph,
    assignCSSNames,
    buildTokenGraph,
    dependentsVia,
    findUnusedTokens,
    groupByContext,
} from "@sugarcube-sh/core";
import { Command } from "commander";
import { relative } from "pathe";
import color from "picocolors";
import {
    type ImpactRow,
    type UsageRow,
    formatImpactBrief,
    formatImpactTable,
    formatImpactTree,
    formatUnusedTable,
    groupUnused,
    tokenValue,
    whereSummary,
} from "../analyze/format.js";
import { UTILITY_SOURCE, scanUtilityUsage } from "../analyze/scan-utilities.js";
import { buildVarNameIndex, lookupToken, usageRoots } from "../analyze/usage-roots.js";
import { CLIError } from "../cli-error.js";
import { ERROR_MESSAGES } from "../constants/error-messages.js";
import { handleError } from "../handle-error.js";
import type { VarRef } from "../lint/scan-css.js";
import { loadTokenConfigOrThrow } from "../load-config.js";
import { plural } from "../plural.js";
import { prepareTokens } from "../prepare-tokens.js";
import { intro, label, outro } from "../prompts/common.js";
import { log, rawLog } from "../prompts/log.js";
import { scanProjectCSS } from "../scan-project.js";

interface UnusedFlags {
    json?: boolean;
    all?: boolean;
}

// Build the dependency graph from the same tokens `generate`
// produces, so names and edges match the emitted CSS. Returns the converted
// tokens too, since the utility scan needs them.
async function buildGraph(
    config: InternalConfig,
): Promise<{ graph: TokenGraph; tokens: NormalizedRenderableTokens }> {
    // NB. Permutations come from `prepareTokens`, not `config.variables.permutations`
    const { trees, resolved, permutations } = await prepareTokens(config);
    const tokens = assignCSSNames(groupByContext(trees, resolved), config);
    const graph = buildTokenGraph(tokens, { permutations });
    return { graph, tokens };
}

async function scanUsage(
    config: InternalConfig,
    tokens: NormalizedRenderableTokens,
): Promise<{ refs: VarRef[]; varScanned: number; classScanned: number }> {
    const { used, files } = await scanProjectCSS(config);
    const utility = await scanUtilityUsage(config, tokens);
    // NB. A component with a `<style>` block is read once for its `var()` and again for its class
    // names, so adding the counts would double-count it.
    return {
        refs: [...used, ...utility.refs],
        varScanned: files.length,
        classScanned: utility.fileCount,
    };
}

const unused = new Command()
    .name("unused")
    .description("List tokens no CSS reaches, following alias chains (graph reachability)")
    .option("--all", "List every unused token path, one per line (for grep/piping)")
    .option("--json", "Output machine-readable JSON")
    .allowExcessArguments(false)
    .action(async (options: UnusedFlags) => {
        try {
            const plain = options.json === true || options.all === true;
            if (!plain) intro(label("Analyze"));

            const config = await loadTokenConfigOrThrow("analyze");
            const { graph, tokens } = await buildGraph(config);

            const usage = await scanUsage(config, tokens);

            if (usage.varScanned === 0) {
                const warning = ERROR_MESSAGES.ANALYZE_UNUSED_NO_FILES_SCANNED(process.cwd());
                
                if (plain) console.error(warning);
                else log.warn(warning);
            }

            const roots = usageRoots(graph, usage.refs);
            const unusedPaths = findUnusedTokens(graph, roots);

            const total = graph.nodes.size;

            if (options.json) {
                console.log(
                    JSON.stringify(
                        {
                            unused: unusedPaths,
                            total,
                            scanned: {
                                forVarReferences: usage.varScanned,
                                forUtilityClasses: usage.classScanned,
                            },
                        },
                        null,
                        2,
                    ),
                );
                return;
            }

            if (options.all) {
                for (const path of unusedPaths) rawLog(path);
                return;
            }

            const scanned = color.dim(
                `${plural(usage.varScanned, "file")} for var(), ${usage.classScanned} for utility classes`,
            );

            if (unusedPaths.length === 0) {
                outro(color.greenBright(`No unused tokens ✨  ${scanned}`));
                return;
            }

            const groups = groupUnused(graph, unusedPaths);
            log.message(formatUnusedTable(groups));
            outro(`${color.yellow(`${unusedPaths.length} of ${total} tokens unused`)}  ${scanned}`);
        } catch (error) {
            handleError(error);
        }
    });

interface ImpactFlags {
    json?: boolean;
    tree?: boolean;
    brief?: boolean;
}

const impact = new Command()
    .name("impact")
    .description("Show everything affected by changing a token (dependent tokens and CSS/markup)")
    .argument("<token>", "Token path, e.g. color.pink.600")
    .option("--tree", "Draw the chains as a tree")
    .option("--brief", "Flat list ranked by how often each is used, hiding pass-through tokens")
    .option("--json", "Output machine-readable JSON")
    .action(async (token: string, options: ImpactFlags) => {
        try {
            if (!options.json) intro(label("Analyze"));

            const config = await loadTokenConfigOrThrow("analyze");
            const { graph, tokens } = await buildGraph(config);

            const node = graph.nodes.get(token);
            if (!node) {
                const near = [...graph.nodes.keys()].filter((id) => id.includes(token)).slice(0, 5);
                const hint = near.length > 0 ? ` Did you mean: ${near.join(", ")}?` : "";
                throw new CLIError(`No token "${token}" in this system.${hint}`);
            }

            const via = dependentsVia(graph, token);
            const dependents = new Set(via.keys());

            const affected = new Set([token, ...dependents]);
            const index = buildVarNameIndex(graph);
            const usage = await scanUsage(config, tokens);

            if (usage.varScanned === 0) {
                const warning = ERROR_MESSAGES.ANALYZE_IMPACT_NO_FILES_SCANNED(process.cwd());
                if (options.json) console.error(warning);
                else log.warn(warning);
            }

            const refsByToken = new Map<string, VarRef[]>();
            for (const ref of usage.refs) {
                const id = lookupToken(index, ref.name);
                if (id !== undefined && affected.has(id)) {
                    refsByToken.set(id, [...(refsByToken.get(id) ?? []), ref]);
                }
            }
            const refCount = [...refsByToken.values()].reduce((n, refs) => n + refs.length, 0);

            if (options.json) {
                console.log(
                    JSON.stringify(
                        {
                            token,
                            type: node.type,
                            dependents: [...dependents].sort().map((id) => ({
                                token: id,
                                references: via.get(id) ?? null,
                            })),
                            consumers: usage.refs
                                .filter((ref) => {
                                    const id = lookupToken(index, ref.name);
                                    return id !== undefined && affected.has(id);
                                })
                                .map((ref) => ({
                                    file:
                                        ref.file === UTILITY_SOURCE
                                            ? null
                                            : relative(process.cwd(), ref.file),
                                    line: ref.line,
                                    var: ref.name,
                                    token: lookupToken(index, ref.name),
                                })),
                        },
                        null,
                        2,
                    ),
                );
                return;
            }

            log.message(`${color.bold(token)}${tokenValue(node)}`);

            if (dependents.size === 0 && refCount === 0) {
                outro(`No token references ${color.yellow(token)}, and no scanned file uses it.`);
                return;
            }

            const rowTokens = new Set(dependents);
            if ((refsByToken.get(token)?.length ?? 0) > 0) rowTokens.add(token);

            if (options.tree) {
                log.message(formatImpactTree(token, via, refsByToken));
            } else if (!options.brief) {
                const children = new Map<string, string[]>();
                for (const [child, parent] of via) {
                    children.set(parent, [...(children.get(parent) ?? []), child]);
                }
                const usesOf = (id: string) => refsByToken.get(id)?.length ?? 0;

                const ordered: string[] = [];
                const walk = (id: string) => {
                    ordered.push(id);
                    for (const kid of (children.get(id) ?? []).sort(
                        (a, b) => usesOf(b) - usesOf(a) || a.localeCompare(b),
                    )) {
                        walk(kid);
                    }
                };
                walk(token);

                const rows: ImpactRow[] = ordered
                    .filter((id) => id !== token || usesOf(token) > 0)
                    .map((id) => ({
                        token: id,
                        references: id === token ? "(this token)" : (via.get(id) ?? ""),
                        refs: usesOf(id),
                        where: whereSummary(refsByToken.get(id) ?? []),
                    }));

                log.message(formatImpactTable(rows));
            } else {
                const rows: UsageRow[] = [...rowTokens]
                    .map((id) => ({
                        token: id,
                        refs: refsByToken.get(id)?.length ?? 0,
                        where: whereSummary(refsByToken.get(id) ?? []),
                    }))
                    .sort((a, b) => b.refs - a.refs || a.token.localeCompare(b.token));

                const hidden = rows.filter((row) => row.refs === 0).length;
                const lines = formatImpactBrief(rows);
                if (hidden > 0) {
                    lines.push(
                        "",
                        color.dim(
                            hidden === 1
                                ? "1 more token references it but isn't used directly — run without --brief"
                                : `${hidden} more tokens reference it but aren't used directly — run without --brief`,
                        ),
                    );
                }
                log.message(lines);
            }

            const name = color.yellow(token);
            if (dependents.size === 0) {
                outro(
                    `${name} is used in ${color.yellow(plural(refCount, "place"))}. No other token references it.`,
                );
            } else if (refCount === 0) {
                outro(
                    `${color.yellow(plural(dependents.size, "token"))} reference ${name}, but no scanned file uses any of them.`,
                );
            } else {
                outro(
                    `${name} and the ${color.yellow(plural(dependents.size, "token"))} that ${dependents.size === 1 ? "references" : "reference"} it are used in ${color.yellow(plural(refCount, "place"))}.`,
                );
            }
        } catch (error) {
            handleError(error);
        }
    });

export const analyze = new Command()
    .name("analyze")
    .description("Report what's true about your token system (insight, not pass/fail)")
    .addCommand(unused)
    .addCommand(impact);
