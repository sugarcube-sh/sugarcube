import type { CSSFileOutput } from "@sugarcube-sh/core";
import { basename, relative } from "pathe";
import color from "picocolors";

export const prefix = color.cyan("[sugarcube]");
export const warnPrefix = color.yellow("[sugarcube]");
export const errorPrefix = color.red("[sugarcube]");

/** The files a generation wrote, once each, relative to the working directory. */
export function outputPaths(output: CSSFileOutput): string[] {
    return [...new Set(output.map((file) => file.path))].map((file) =>
        relative(process.cwd(), file),
    );
}

export function logWarnings(warnings: Array<{ message: string }>): void {
    for (const warning of warnings) console.log(`${warnPrefix} ${warning.message}`);
}

/** One line per regeneration: the file that changed, what it wrote, and how long it took. */
export function logRegenerated(changedPath: string, output: CSSFileOutput, ms: number): void {
    console.log(
        `${prefix} ${color.dim(basename(changedPath))} → ${outputPaths(output).join(", ")} ${color.dim(`(${ms}ms)`)}`,
    );
}
