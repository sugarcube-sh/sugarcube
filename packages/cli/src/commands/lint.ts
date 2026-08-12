import type { InternalConfig } from "@sugarcube-sh/core";
import { Command, Option } from "commander";
import { relative } from "pathe";
import color from "picocolors";
import { ERROR_MESSAGES } from "../constants/error-messages.js";
import { handleError } from "../handle-error.js";
import { type VarRef, findUndeclared } from "../lint/scan-css.js";
import { type SyntaxResolver, createSyntaxResolver } from "../lint/syntaxes.js";
import { getGeneratedVarNames } from "../lint/token-var-names.js";
import { loadTokenConfigOrThrow } from "../load-config.js";
import { plural } from "../plural.js";
import { findUnreadStylesheets, scanProjectCSS } from "../scan-project.js";
import { warningBoxWithBadge } from "../prompts/box-with-badge.js";
import { intro, label, outro } from "../prompts/common.js";
import { log } from "../prompts/log.js";
import type { LintOptions, ScanOutput } from "../types/commands.js";

function parseIgnore(value: string | undefined): string[] {
    if (!value) return [];
    return value
        .split(",")
        .map((prefix) => prefix.trim())
        .filter(Boolean);
}

async function runScan(
    config: InternalConfig,
    paths: string[],
    ignorePrefixes: string[],
    resolver: SyntaxResolver,
): Promise<ScanOutput> {
    const declared = await getGeneratedVarNames(config);

    const scan = await scanProjectCSS(config, paths, resolver);
    for (const name of scan.declared) declared.add(name);

    const { broken, fallback } = findUndeclared(scan.used, declared, ignorePrefixes);
    return {
        broken,
        fallback,
        refCount: scan.used.length,
        scannedFiles: scan.files.length,
        unread: paths.length > 0 ? [] : await findUnreadStylesheets(config, scan.files, resolver),
    };
}

function formatGroupedRefs(refs: VarRef[]): string[] {
    const byFile = new Map<string, VarRef[]>();
    for (const ref of refs) {
        const file = relative(process.cwd(), ref.file);
        byFile.set(file, [...(byFile.get(file) ?? []), ref]);
    }

    const width = Math.max(...refs.map((ref) => String(ref.line).length));

    const lines: string[] = [];
    for (const file of [...byFile.keys()].sort()) {
        const group = (byFile.get(file) ?? []).sort((a, b) => a.line - b.line);
        lines.push(color.dim(file));
        for (const ref of group) {
            const lineNo = color.dim(String(ref.line).padStart(width));
            const reference = ref.hasFallback ? `var(${ref.name}, …)` : `var(${ref.name})`;
            lines.push(` ${lineNo}  ${color.yellow(reference)}`);
        }
    }
    return lines;
}

export const lint = new Command()
    .name("lint")
    .description("Find var() references to variables your tokens and CSS don't declare")
    .argument(
        "[paths...]",
        "Directories or globs to scan, e.g. ../css (default: project CSS and components)",
    )
    .option(
        "--ignore <prefixes>",
        'Comma-separated var-name prefixes to ignore (e.g. "--sl-,--radix-,--ec-")',
    )
    .addOption(
        new Option("--fallback <level>", "How to treat references that have a fallback")
            .choices(["error", "warn", "off"])
            .default("warn"),
    )
    .option("--json", "Output machine-readable JSON")
    .action(async (paths: string[], options: LintOptions) => {
        try {
            if (!options.json) intro(label("Lint"));

            const config = await loadTokenConfigOrThrow("lint");
            const resolver = createSyntaxResolver();
            const ignorePrefixes = parseIgnore(options.ignore);
            const fallbackLevel = options.fallback ?? "warn";
            const fallbackIsError = fallbackLevel === "error";

            if (options.json) {
                const { broken, fallback, scannedFiles, unread } = await runScan(
                    config,
                    paths,
                    ignorePrefixes,
                    resolver,
                );

                if (scannedFiles === 0) {
                    console.error(ERROR_MESSAGES.LINT_NO_FILES_SCANNED(process.cwd()));
                    process.exitCode = 1;
                } else if (unread.length > 0) {
                    console.error(ERROR_MESSAGES.LINT_UNREAD_STYLESHEETS(unread));
                }

                const portable = (refs: VarRef[]) =>
                    refs.map((ref) => ({ ...ref, file: relative(process.cwd(), ref.file) }));
                console.log(
                    JSON.stringify(
                        { noFallback: portable(broken), fallback: portable(fallback) },
                        null,
                        2,
                    ),
                );
                if (broken.length > 0 || (fallbackIsError && fallback.length > 0)) {
                    process.exitCode = 1;
                }
                return;
            }

            const { broken, fallback, refCount, scannedFiles, unread } = await runScan(
                config,
                paths,
                ignorePrefixes,
                resolver,
            );
            const showFallback = fallbackLevel !== "off";
            const reportFallback = fallbackIsError ? log.error : log.warn;

            if (broken.length > 0) {
                log.error(
                    [
                        color.bold(`References without fallback (${broken.length})`),
                        "",
                        ...formatGroupedRefs(broken),
                    ].join("\n"),
                );
            }

            if (showFallback && fallback.length > 0) {
                reportFallback(
                    [
                        color.bold(`References with fallback (${fallback.length})`),
                        "",
                        ...formatGroupedRefs(fallback),
                    ].join("\n"),
                );
            }

            const scanned = color.dim(
                `${plural(refCount, "variable reference")} in ${plural(scannedFiles, "file")}`,
            );

            const visibleTotal = broken.length + (showFallback ? fallback.length : 0);

            if (scannedFiles === 0) {
                log.space(1);
                warningBoxWithBadge(ERROR_MESSAGES.LINT_NO_FILES_SCANNED(process.cwd()));
                process.exitCode = 1;
                return;
            }

            if (unread.length > 0) {
                log.space(1);
                warningBoxWithBadge(ERROR_MESSAGES.LINT_UNREAD_STYLESHEETS(unread));
            }

            if (visibleTotal === 0) {
                const headline = showFallback
                    ? "No undeclared references"
                    : "No references without fallback";
                outro(
                    unread.length > 0
                        ? color.yellow(`${headline}  ${scanned}`)
                        : color.greenBright(`${headline} ✨  ${scanned}`),
                );
            } else {
                const parts: string[] = [];
                if (broken.length > 0) parts.push(color.red(`${broken.length} without fallback`));
                if (showFallback && fallback.length > 0)
                    parts.push(color.dim(`${fallback.length} with fallback`));
                outro(`${parts.join(color.dim(", "))}  ${scanned}`);
            }

            if (broken.length > 0 || (fallbackIsError && fallback.length > 0)) {
                process.exitCode = 1;
            }
        } catch (error) {
            handleError(error);
        }
    });
