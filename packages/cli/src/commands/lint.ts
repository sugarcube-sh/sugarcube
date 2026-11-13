import { pluralize } from "@sugarcube-sh/core";
import { Command, Option } from "commander";
import { relative } from "pathe";
import color from "picocolors";
import { type BuildResult, build, getTokenByVariable } from "../build.js";
import { ErrorMessages } from "../constants/error-messages.js";
import { handleError } from "../handle-error.js";
import { findUndeclared } from "../lint/undeclared.js";
import { loadTokenConfigOrThrow } from "../load-config.js";
import { printProblems, getProblemContext } from "../problems.js";
import type { VarReference } from "../scan-css.js";
import { type ScanWarning, scanStylesheets, getScanWarning } from "../scan-stylesheets.js";
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

async function findUndeclaredReferences(
    built: BuildResult,
    paths: string[],
    ignorePrefixes: string[],
) {
    const scan = await scanStylesheets(built, paths);
    const declared = new Set([
        ...getTokenByVariable(built).keys(),
        ...(built.utilityCSS?.customProperties ?? []),
        ...scan.declared,
    ]);
    const { withoutFallback, withFallback } = findUndeclared(scan.used, declared, ignorePrefixes);
    return {
        withoutFallback,
        withFallback,
        refCount: scan.used.length,
        scannedFiles: scan.files.length,
        scanWarning: getScanWarning(scan),
    };
}

function formatLintWarning(warning: ScanWarning): string {
    return warning.kind === "nothing-read"
        ? ErrorMessages.LINT_NO_FILES_SCANNED(process.cwd())
        : ErrorMessages.LINT_UNREAD_STYLESHEETS(warning.unread);
}

function formatReferencesByFile(refs: VarReference[]): string[] {
    const byFile = new Map<string, VarReference[]>();
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
            const failed = printProblems(built.diagnostics, getProblemContext(built), {
                onlyErrors: true,
                failureText: ErrorMessages.NOTHING_LINTED(),
                ...(options.json && { stream: process.stderr }),
            });
            if (failed) {
                process.exitCode = 1;
                return;
            }
            const ignorePrefixes = parseIgnore(options.ignore);
            const fallbackLevel = options.fallback ?? "warn";
            const fallbackIsError = fallbackLevel === "error";
            const { withoutFallback, withFallback, refCount, scannedFiles, scanWarning } =
                await findUndeclaredReferences(built, paths, ignorePrefixes);
            if (withoutFallback.length > 0 || (fallbackIsError && withFallback.length > 0)) {
                process.exitCode = 1;
            }

            if (options.json) {
                if (scanWarning) printWarning(formatLintWarning(scanWarning), { plain: true });
                if (scanWarning?.kind === "nothing-read") process.exitCode = 1;

                const toRelativePaths = (refs: VarReference[]) =>
                    refs.map((ref) => ({ ...ref, file: relative(process.cwd(), ref.file) }));
                console.log(
                    JSON.stringify(
                        {
                            withoutFallback: toRelativePaths(withoutFallback),
                            withFallback: toRelativePaths(withFallback),
                        },
                        null,
                        2,
                    ),
                );
                return;
            }

            const showFallback = fallbackLevel !== "off";
            const reportFallback = fallbackIsError ? log.error : log.warn;

            if (withoutFallback.length > 0) {
                log.error(
                    [
                        color.bold(`References without fallback (${withoutFallback.length})`),
                        "",
                        ...formatReferencesByFile(withoutFallback),
                    ].join("\n"),
                );
            }

            if (showFallback && withFallback.length > 0) {
                reportFallback(
                    [
                        color.bold(`References with fallback (${withFallback.length})`),
                        "",
                        ...formatReferencesByFile(withFallback),
                    ].join("\n"),
                );
            }

            const scanned = color.dim(
                `${pluralize(refCount, "variable reference")} in ${pluralize(scannedFiles, "file")}`,
            );

            const visibleTotal = withoutFallback.length + (showFallback ? withFallback.length : 0);

            if (scanWarning) printWarning(formatLintWarning(scanWarning), { plain: false });
            if (scanWarning?.kind === "nothing-read") {
                process.exitCode = 1;
                return;
            }

            if (visibleTotal === 0) {
                const headline = showFallback
                    ? "No undeclared references"
                    : "No references without fallback";
                outro(
                    scanWarning
                        ? color.yellow(`${headline}  ${scanned}`)
                        : color.greenBright(`${headline} ✨  ${scanned}`),
                );
            } else {
                const parts: string[] = [];
                if (withoutFallback.length > 0)
                    parts.push(color.red(`${withoutFallback.length} without fallback`));
                if (showFallback && withFallback.length > 0)
                    parts.push(color.dim(`${withFallback.length} with fallback`));
                outro(`${parts.join(color.dim(", "))}  ${scanned}`);
            }
        } catch (error) {
            handleError(error);
        }
    });
