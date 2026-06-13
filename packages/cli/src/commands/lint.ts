import { readFile } from "node:fs/promises";
import { loadInternalConfig } from "@sugarcube-sh/core";
import { Command } from "commander";
import { relative, resolve } from "pathe";
import color from "picocolors";
import { glob } from "tinyglobby";
import { CLIError } from "../cli-error.js";
import { handleError } from "../handle-error.js";
import { type VarRef, findDangling, findUnused, scanCSS } from "../lint/scan-css.js";
import { getGeneratedVarNames } from "../lint/token-var-names.js";
import { intro, label, outro } from "../prompts/common.js";

// Phase 1 scans plain stylesheets only. Component `<style>` blocks
// (.astro/.vue/.svelte via postcss-html) are phase 2.
const STYLESHEET_GLOB = "**/*.css";

interface LintFlags {
    ignore?: string;
    errorsOnly?: boolean;
    unused?: boolean;
    strict?: boolean;
    json?: boolean;
}

function parseIgnore(value: string | undefined): string[] {
    if (!value) return [];
    return value
        .split(",")
        .map((prefix) => prefix.trim())
        .filter(Boolean);
}

function formatRef(ref: VarRef): string {
    const location = relative(process.cwd(), ref.file);
    const reference = ref.hasFallback ? `var(${ref.name}, …)` : `var(${ref.name})`;
    return `    ${color.dim(`${location}:${ref.line}`)}  ${color.yellow(reference)}`;
}

function printSection(title: string, lines: string[]): void {
    if (lines.length === 0) return;
    console.log("");
    console.log(`  ${color.bold(title)}`);
    for (const line of lines) console.log(line);
}

export const lint = new Command()
    .name("lint")
    .description("Find var() references that point to a token that doesn't exist")
    .argument("[paths...]", "Globs of files to scan (default: project CSS)")
    .option("--ignore <prefixes>", "Comma-separated var-name prefixes to ignore (e.g. --sl-,--ec-)")
    .option("--errors-only", "Show only broken references, hide fallback-masked ones")
    .option("--unused", "Also report declared tokens that are never referenced")
    .option("--strict", "Fail the exit code on masked/unused findings too, not just broken")
    .option("--json", "Output machine-readable JSON")
    .action(async (paths: string[], options: LintFlags) => {
        try {
            if (!options.json) intro(label("Lint"));

            let config: Awaited<ReturnType<typeof loadInternalConfig>>["config"];
            try {
                ({ config } = await loadInternalConfig());
            } catch {
                throw new CLIError(
                    "No sugarcube config found. Run `sugarcube lint` from a project with a sugarcube config."
                );
            }

            // Authoritative set of names sugarcube generates from the current config.
            const declared = await getGeneratedVarNames(config);

            // Don't scan our own generated output — its declarations already
            // come from the config above, and it isn't authored CSS.
            const generatedOutput = resolve(process.cwd(), config.variables.path);

            const files = await glob(paths.length > 0 ? paths : [STYLESHEET_GLOB], {
                cwd: process.cwd(),
                absolute: true,
                ignore: ["**/node_modules/**", "**/dist/**", generatedOutput],
            });

            // Collect every declaration (so a var declared in one file legitimises
            // its use in another) and every reference across the project.
            const allUsed: VarRef[] = [];
            for (const file of files) {
                const css = await readFile(file, "utf-8");
                const { declared: fileDeclared, used } = scanCSS(css, file);
                for (const name of fileDeclared) declared.add(name);
                allUsed.push(...used);
            }

            const ignorePrefixes = parseIgnore(options.ignore);
            const { broken, masked } = findDangling(allUsed, declared, ignorePrefixes);
            const unused = options.unused ? findUnused(declared, allUsed, ignorePrefixes) : [];

            if (options.json) {
                console.log(JSON.stringify({ broken, masked, unused }, null, 2));
            } else {
                const showMasked = !options.errorsOnly && masked.length > 0;

                printSection("Broken — no fallback, not declared anywhere", broken.map(formatRef));
                if (showMasked) {
                    printSection(
                        "Masked — not declared, but a fallback is being applied",
                        masked.map(formatRef)
                    );
                }
                if (options.unused) {
                    printSection(
                        "Unused — declared but never referenced",
                        unused.map((name) => `    ${color.dim(name)}`)
                    );
                }

                const parts: string[] = [`${broken.length} broken`];
                if (!options.errorsOnly) parts.push(`${masked.length} masked`);
                if (options.unused) parts.push(`${unused.length} unused`);

                console.log("");
                if (broken.length === 0 && (options.errorsOnly || masked.length === 0)) {
                    outro(
                        color.greenBright(
                            `No broken references ✨  (${parts.join(" · ")}, ${allUsed.length} checked across ${files.length} files)`
                        )
                    );
                } else {
                    outro(color.yellow(parts.join(" · ")));
                }
            }

            const failed =
                broken.length > 0 ||
                (options.strict === true && (masked.length > 0 || unused.length > 0));
            if (failed) process.exitCode = 1;
        } catch (error) {
            handleError(error);
        }
    });
