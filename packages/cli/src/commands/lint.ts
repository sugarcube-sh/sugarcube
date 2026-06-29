import { readFile } from "node:fs/promises";
import { type InternalConfig, loadInternalConfig } from "@sugarcube-sh/core";
import { Command } from "commander";
import { relative, resolve } from "pathe";
import color from "picocolors";
import { glob } from "tinyglobby";
import { CLIError } from "../cli-error.js";
import { IGNORED_DIR_GLOBS } from "../constants/markup.js";
import { buildExtensionGlob } from "../glob.js";
import { handleError } from "../handle-error.js";
import { type VarRef, findUndeclared, scanCSS } from "../lint/scan-css.js";
import { type SyntaxResolver, createSyntaxResolver } from "../lint/syntaxes.js";
import { getGeneratedVarNames } from "../lint/token-var-names.js";
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
    files: string[],
    ignorePrefixes: string[],
    resolver: SyntaxResolver
): Promise<ScanOutput> {
    const declared = await getGeneratedVarNames(config);

    const allUsed: VarRef[] = [];
    let scannedFiles = 0;
    const skipped = new Map<string, number>();

    for (const file of files) {
        const resolution = await resolver.resolve(file);
        if (resolution.kind === "unsupported") continue;
        if (resolution.kind === "missing") {
            skipped.set(resolution.module, (skipped.get(resolution.module) ?? 0) + 1);
            continue;
        }

        const css = await readFile(file, "utf-8");
        const { declared: fileDeclared, used } = scanCSS(css, file, resolution.parse);
        for (const name of fileDeclared) declared.add(name);
        allUsed.push(...used);
        scannedFiles++;
    }

    const { broken, fallback } = findUndeclared(allUsed, declared, ignorePrefixes);
    return { broken, fallback, refCount: allUsed.length, scannedFiles, skipped };
}

function formatSkipped(skipped: Map<string, number>): string[] {
    const lines: string[] = [];
    for (const [module, count] of skipped) {
        const files = count === 1 ? "file" : "files";
        lines.push(
            `${count} ${files} need ${color.bold(module)}  ${color.cyan(`npm i -D ${module}`)}`
        );
    }
    return lines;
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
    .argument("[paths...]", "Globs of files to scan (default: project CSS and components)")
    .option(
        "--ignore <prefixes>",
        'Comma-separated var-name prefixes to ignore (e.g. "--sl-,--radix-,--ec-")'
    )
    .option("--strict", "Treat references that have a fallback as errors too")
    .option("--json", "Output machine-readable JSON")
    .action(async (paths: string[], options: LintOptions) => {
        try {
            if (!options.json) intro(label("Lint"));

            let config: InternalConfig;
            try {
                ({ config } = await loadInternalConfig());
            } catch {
                throw new CLIError(
                    "No sugarcube config found. Run `sugarcube lint` from a project with a sugarcube config."
                );
            }

            const resolver = createSyntaxResolver();

            const generatedOutput = resolve(process.cwd(), config.variables.path);
            const files = await glob(
                paths.length > 0 ? paths : [buildExtensionGlob(resolver.extensions())],
                {
                    cwd: process.cwd(),
                    absolute: true,
                    caseSensitiveMatch: false,
                    ignore: [...IGNORED_DIR_GLOBS, generatedOutput],
                }
            );
            const ignorePrefixes = parseIgnore(options.ignore);

            if (options.json) {
                const { broken, fallback, skipped } = await runScan(
                    config,
                    files,
                    ignorePrefixes,
                    resolver
                );
                console.log(
                    JSON.stringify(
                        { broken, fallback, skipped: Object.fromEntries(skipped) },
                        null,
                        2
                    )
                );
                if (broken.length > 0 || (options.strict === true && fallback.length > 0)) {
                    process.exitCode = 1;
                }
                return;
            }

            const { broken, fallback, refCount, scannedFiles, skipped } = await runScan(
                config,
                files,
                ignorePrefixes,
                resolver
            );
            const undefinedTotal = broken.length + fallback.length;
            const skippedTotal = [...skipped.values()].reduce((sum, n) => sum + n, 0);

            const fallbackIsError = options.strict === true;
            const reportFallback = fallbackIsError ? log.error : log.warn;

            if (broken.length > 0) {
                log.error(
                    [
                        color.bold(`Undefined references (${broken.length})`),
                        "",
                        ...formatGroupedRefs(broken),
                    ].join("\n")
                );
            }

            if (fallback.length > 0) {
                reportFallback(
                    [
                        color.bold(`Undefined, but with a fallback (${fallback.length})`),
                        "",
                        ...formatGroupedRefs(fallback),
                    ].join("\n")
                );
            }

            if (skippedTotal > 0) {
                log.warn(
                    [
                        color.bold(`Not scanned (${skippedTotal})`),
                        "",
                        ...formatSkipped(skipped),
                    ].join("\n")
                );
            }

            const skippedNote = skippedTotal > 0 ? ` · ${skippedTotal} skipped` : "";
            const scanned = color.dim(`${refCount} refs · ${scannedFiles} files${skippedNote}`);

            if (undefinedTotal === 0) {
                outro(color.greenBright(`No undefined references ✨  ${scanned}`));
            } else {
                const parts: string[] = [];
                if (broken.length > 0) parts.push(color.red(`${broken.length} undefined`));
                if (fallback.length > 0)
                    parts.push(color.dim(`${fallback.length} with a fallback`));
                outro(`${parts.join(color.dim(", "))}  ${scanned}`);
            }

            if (broken.length > 0 || (fallbackIsError && fallback.length > 0)) {
                process.exitCode = 1;
            }
        } catch (error) {
            handleError(error);
        }
    });
