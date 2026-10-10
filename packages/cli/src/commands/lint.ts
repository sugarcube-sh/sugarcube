import { plural } from "@sugarcube-sh/core";
import { Command, Option } from "commander";
import { relative } from "pathe";
import color from "picocolors";
import { type Built, build, variablesOf } from "../build.js";
import { ERROR_MESSAGES } from "../constants/error-messages.js";
import { handleError } from "../handle-error.js";
import { findUndeclared } from "../lint/undeclared.js";
import { loadTokenConfigOrThrow } from "../load-config.js";
import { printProblems, whereOf } from "../problems.js";
import type { VarRef } from "../scan-css.js";
import { type Shortfall, scanStylesheets, shortfallOf } from "../scan-stylesheets.js";
import { printWarning } from "../prompts/box-with-badge.js";
import { intro, label, outro } from "../prompts/common.js";
import { log } from "../prompts/log.js";
import type { LintOptions } from "../types/commands.js";

function parseIgnore(value: string | undefined): string[] {
    if (!value) return [];
    return value
        .split(",")
        .map((prefix) => prefix.trim())
        .filter(Boolean);
}

async function runScan(built: Built, paths: string[], ignorePrefixes: string[]) {
    const scan = await scanStylesheets(built, paths);
    const declared = new Set([
        ...variablesOf(built).keys(),
        ...(built.utilityRules?.customProperties ?? []),
        ...scan.declared,
    ]);
    const { broken, fallback } = findUndeclared(scan.used, declared, ignorePrefixes);
    return {
        broken,
        fallback,
        refCount: scan.used.length,
        scannedFiles: scan.files.length,
        shortfall: shortfallOf(scan),
    };
}

function shortfallWarning(found: Shortfall): string {
    return found.kind === "nothing-read"
        ? ERROR_MESSAGES.LINT_NO_FILES_SCANNED(process.cwd())
        : ERROR_MESSAGES.LINT_UNREAD_STYLESHEETS(found.unread);
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
    .description("Check your CSS and markup only use variables your tokens declare")
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

            const built = await build(await loadTokenConfigOrThrow("lint"), { markup: false });
            const failed = printProblems(built.diagnostics, whereOf(built), {
                onlyErrors: true,
                whenFailed: ERROR_MESSAGES.NOTHING_LINTED(),
                ...(options.json && { to: process.stderr }),
            });
            if (failed) {
                process.exitCode = 1;
                return;
            }
            const ignorePrefixes = parseIgnore(options.ignore);
            const fallbackLevel = options.fallback ?? "warn";
            const fallbackIsError = fallbackLevel === "error";
            const { broken, fallback, refCount, scannedFiles, shortfall } = await runScan(
                built,
                paths,
                ignorePrefixes,
            );
            if (broken.length > 0 || (fallbackIsError && fallback.length > 0)) {
                process.exitCode = 1;
            }

            if (options.json) {
                if (shortfall) printWarning(shortfallWarning(shortfall), { plain: true });
                if (shortfall?.kind === "nothing-read") process.exitCode = 1;

                const portable = (refs: VarRef[]) =>
                    refs.map((ref) => ({ ...ref, file: relative(process.cwd(), ref.file) }));
                console.log(
                    JSON.stringify(
                        { noFallback: portable(broken), fallback: portable(fallback) },
                        null,
                        2,
                    ),
                );
                return;
            }

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

            if (shortfall) printWarning(shortfallWarning(shortfall), { plain: false });
            if (shortfall?.kind === "nothing-read") {
                process.exitCode = 1;
                return;
            }

            if (visibleTotal === 0) {
                const headline = showFallback
                    ? "No undeclared references"
                    : "No references without fallback";
                outro(
                    shortfall
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
        } catch (error) {
            handleError(error);
        }
    });
