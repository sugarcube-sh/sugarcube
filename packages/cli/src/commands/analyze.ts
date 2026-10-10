import { plural } from "@sugarcube-sh/core";
import { group } from "@sugarcube-sh/dtcg";
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
import {
    chooseParents,
    defaultContextParents,
    describeElidedParents,
    hopsTo,
    parentsOf,
} from "../analyze/multi-parent.js";
import {
    type System,
    UTILITY_SOURCE,
    lookupToken,
    systemOf,
    unusedTokens,
    usageRoots,
    utilityRefs,
} from "../analyze/system.js";
import { type Built, build } from "../build.js";
import { CLIError } from "../cli-error.js";
import { ERROR_MESSAGES } from "../constants/error-messages.js";
import { handleError } from "../handle-error.js";
import type { VarRef } from "../lint/scan-css.js";
import { loadTokenConfigOrThrow } from "../load-config.js";
import { printProblems, whereOf } from "../problems.js";
import { warningBoxWithBadge } from "../prompts/box-with-badge.js";
import { intro, label, outro } from "../prompts/common.js";
import { log, rawLog } from "../prompts/log.js";
import { type UnreadStylesheets, findUnreadStylesheets, scanProjectCSS } from "../scan-project.js";

interface UnusedFlags {
    json?: boolean;
    all?: boolean;
}

async function systemFor(plain: boolean): Promise<{ built: Built; system: System } | undefined> {
    const built = await build(await loadTokenConfigOrThrow("analyze"));
    const failed = printProblems(built.diagnostics, whereOf(built), {
        onlyErrors: true,
        whenFailed: ERROR_MESSAGES.NOTHING_ANALYSED(),
        ...(plain && { to: process.stderr }),
    });
    if (failed) {
        process.exitCode = 1;
        return undefined;
    }
    return { built, system: systemOf(built) };
}

async function scanUsage(built: Built): Promise<{
    refs: VarRef[];
    varScanned: number;
    classScanned: number;
    unread: UnreadStylesheets[];
}> {
    const { used, files } = await scanProjectCSS(built.config);
    return {
        refs: [...used, ...utilityRefs(built)],
        varScanned: files.length,
        classScanned: built.markupFiles.length,
        unread: await findUnreadStylesheets(built.config, files),
    };
}

function tokenFor(system: System, path: string) {
    const found = system.tokens.get(path);
    if (found) return found;
    const isGroup = system.permutations.some((permutation) => group(permutation, path));
    throw new CLIError(
        isGroup
            ? ERROR_MESSAGES.ANALYZE_GROUP_NOT_TOKEN(path)
            : ERROR_MESSAGES.ANALYZE_NO_TOKEN(path),
    );
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

            const analysed = await systemFor(plain);
            if (!analysed) return;
            const { built, system } = analysed;

            const usage = await scanUsage(built);

            const shortfall =
                usage.varScanned === 0
                    ? ERROR_MESSAGES.ANALYZE_UNUSED_NO_FILES_SCANNED(process.cwd())
                    : usage.unread.length > 0
                      ? ERROR_MESSAGES.ANALYZE_UNREAD_STYLESHEETS(usage.unread)
                      : undefined;

            if (shortfall) {
                if (plain) {
                    console.error(shortfall);
                } else {
                    log.space(1);
                    warningBoxWithBadge(shortfall);
                }
            }

            const unusedPaths = unusedTokens(system, usageRoots(system, usage.refs));

            const total = system.tokens.size;

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

            const groups = groupUnused(system.tokens.keys(), unusedPaths);
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

            const analysed = await systemFor(options.json === true);
            if (!analysed) return;
            const { built, system } = analysed;

            const found = tokenFor(system, token);

            const hops = hopsTo(system.permutations, token);
            const parents = parentsOf(hops);
            const dependents = new Set(parents.keys());

            const affected = new Set([token, ...dependents]);
            const usage = await scanUsage(built);

            const shortfall =
                usage.varScanned === 0
                    ? ERROR_MESSAGES.ANALYZE_IMPACT_NO_FILES_SCANNED(process.cwd())
                    : usage.unread.length > 0
                      ? ERROR_MESSAGES.ANALYZE_UNREAD_STYLESHEETS(usage.unread)
                      : undefined;

            if (shortfall) {
                if (options.json) {
                    console.error(shortfall);
                } else {
                    log.space(1);
                    warningBoxWithBadge(shortfall);
                }
            }

            const refsByToken = new Map<string, VarRef[]>();
            for (const ref of usage.refs) {
                const id = lookupToken(system, ref.name);
                if (id !== undefined && affected.has(id)) {
                    refsByToken.set(id, [...(refsByToken.get(id) ?? []), ref]);
                }
            }
            const refCount = [...refsByToken.values()].reduce((n, refs) => n + refs.length, 0);

            const usesOf = (id: string) => refsByToken.get(id)?.length ?? 0;
            const chosen = chooseParents(
                parents,
                usesOf,
                defaultContextParents(hops, system.defaultPermutation),
            );
            const elided = describeElidedParents(hops);

            if (options.json) {
                console.log(
                    JSON.stringify(
                        {
                            token,
                            type: found.type,
                            dependents: [...dependents].sort().map((id) => ({
                                token: id,
                                references: [...(parents.get(id) ?? [])].sort(),
                            })),
                            consumers: usage.refs
                                .filter((ref) => {
                                    const id = lookupToken(system, ref.name);
                                    return id !== undefined && affected.has(id);
                                })
                                .map((ref) => ({
                                    file:
                                        ref.file === UTILITY_SOURCE
                                            ? null
                                            : relative(process.cwd(), ref.file),
                                    line: ref.line,
                                    var: ref.name,
                                    token: lookupToken(system, ref.name),
                                })),
                        },
                        null,
                        2,
                    ),
                );
                return;
            }

            log.message(`${color.bold(token)}${tokenValue(found)}`);

            if (dependents.size === 0 && refCount === 0) {
                outro(`No token references ${color.yellow(token)}, and no scanned file uses it.`);
                return;
            }

            const rowTokens = new Set(dependents);
            if ((refsByToken.get(token)?.length ?? 0) > 0) rowTokens.add(token);

            if (options.tree) {
                log.message(
                    formatImpactTree({
                        target: token,
                        parents,
                        chosen,
                        refsByToken,
                        elided,
                    }),
                );
            } else if (!options.brief) {
                const children = new Map<string, string[]>();
                for (const [child, parent] of chosen) {
                    children.set(parent, [...(children.get(parent) ?? []), child]);
                }

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
                        references: id === token ? "(this token)" : (chosen.get(id) ?? ""),
                        ...(elided.has(id) ? { axis: elided.get(id) } : {}),
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
