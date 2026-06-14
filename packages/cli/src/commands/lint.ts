import { readFile } from "node:fs/promises";
import { type InternalConfig, loadInternalConfig } from "@sugarcube-sh/core";
import { Command } from "commander";
import { relative, resolve } from "pathe";
import color from "picocolors";
import { glob } from "tinyglobby";
import { CLIError } from "../cli-error.js";
import { handleError } from "../handle-error.js";
import { type VarRef, findDangling, scanCSS } from "../lint/scan-css.js";
import { getGeneratedVarNames } from "../lint/token-var-names.js";
import { intro, label, outro } from "../prompts/common.js";
import { log } from "../prompts/log.js";

// Phase 1 scans plain stylesheets only. Component `<style>` blocks
// (.astro/.vue/.svelte via postcss-html) are phase 2.
const STYLESHEET_GLOB = "**/*.css";

interface LintFlags {
    ignore?: string;
    quiet?: boolean;
    strict?: boolean;
    json?: boolean;
}

interface ScanOutput {
    broken: VarRef[];
    masked: VarRef[];
    refCount: number;
}

function parseIgnore(value: string | undefined): string[] {
    if (!value) return [];
    return value
        .split(",")
        .map((prefix) => prefix.trim())
        .filter(Boolean);
}

// Scan the project's CSS and classify undefined references. Shared by the human
// (task-wrapped) and `--json` paths so they can't drift.
async function runScan(
    config: InternalConfig,
    files: string[],
    ignorePrefixes: string[]
): Promise<ScanOutput> {
    // Authoritative set of names sugarcube generates from the current config.
    const declared = await getGeneratedVarNames(config);

    // Collect every declaration (so a var declared in one file legitimises its
    // use in another) and every reference across the project.
    const allUsed: VarRef[] = [];
    for (const file of files) {
        const css = await readFile(file, "utf-8");
        const { declared: fileDeclared, used } = scanCSS(css, file);
        for (const name of fileDeclared) declared.add(name);
        allUsed.push(...used);
    }

    const { broken, masked } = findDangling(allUsed, declared, ignorePrefixes);
    return { broken, masked, refCount: allUsed.length };
}

// Group references by file (like eslint/stylelint) so the path is shown once as
// a sub-header instead of repeated on every line. Returns the content lines for
// the `log` helper, which prepends the `│` bar to each. Line numbers are
// right-aligned within a file so the `var(…)` column lines up.
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
    .description("Find var() references that point to a token that doesn't exist")
    .argument("[paths...]", "Globs of files to scan (default: project CSS)")
    .option(
        "--ignore <prefixes>",
        'Comma-separated var-name prefixes to ignore (e.g. "--sl-,--radix-,--ec-")'
    )
    .option("-q, --quiet", "Show only broken references, hide fallback-masked ones")
    .option("--strict", "Also fail the exit code on masked findings, not just broken")
    .option("--json", "Output machine-readable JSON")
    .action(async (paths: string[], options: LintFlags) => {
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

            // Don't scan our own generated output — its declarations come from the
            // config (in runScan), and it isn't authored CSS.
            const generatedOutput = resolve(process.cwd(), config.variables.path);
            const files = await glob(paths.length > 0 ? paths : [STYLESHEET_GLOB], {
                cwd: process.cwd(),
                absolute: true,
                ignore: ["**/node_modules/**", "**/dist/**", generatedOutput],
            });
            const ignorePrefixes = parseIgnore(options.ignore);

            if (options.json) {
                const { broken, masked } = await runScan(config, files, ignorePrefixes);
                console.log(JSON.stringify({ broken, masked }, null, 2));
                if (broken.length > 0 || (options.strict === true && masked.length > 0)) {
                    process.exitCode = 1;
                }
                return;
            }

            const { broken, masked, refCount } = await runScan(config, files, ignorePrefixes);
            const showMasked = !options.quiet && masked.length > 0;

            if (broken.length > 0) {
                log.error(
                    [
                        color.bold(`Undefined (${broken.length})`),
                        "",
                        ...formatGroupedRefs(broken),
                    ].join("\n")
                );
            }

            if (showMasked) {
                log.warn(
                    [
                        color.bold(`Undefined with fallback (${masked.length})`),
                        "",
                        ...formatGroupedRefs(masked),
                    ].join("\n")
                );
            }

            const scanned = color.dim(`${refCount} refs · ${files.length} files`);

            if (broken.length === 0) {
                const maskedNote =
                    !options.quiet && masked.length > 0
                        ? color.dim(` · ${masked.length} with fallback`)
                        : "";
                outro(color.greenBright(`No undefined references ✨  ${scanned}${maskedNote}`));
            } else {
                const maskedNote = showMasked
                    ? color.yellow(` · ${masked.length} with fallback`)
                    : "";
                outro(`${color.red(`${broken.length} undefined`)}${maskedNote}  ${scanned}`);
            }

            if (broken.length > 0 || (options.strict === true && masked.length > 0)) {
                process.exitCode = 1;
            }
        } catch (error) {
            handleError(error);
        }
    });
