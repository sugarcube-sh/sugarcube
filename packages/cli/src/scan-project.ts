import { readFile } from "node:fs/promises";
import type { InternalConfig } from "@sugarcube-sh/core";
import { resolve } from "pathe";
import { glob } from "tinyglobby";
import { IGNORED_DIR_GLOBS } from "./constants/markup.js";
import { buildExtensionGlob } from "./glob.js";
import { type VarRef, scanCSS } from "./lint/scan-css.js";
import { type SyntaxResolver, createSyntaxResolver } from "./lint/syntaxes.js";

export interface ProjectScan {
    files: string[];
    declared: Set<string>;
    used: VarRef[];
}

function discoveryPatterns(config: InternalConfig, resolver: SyntaxResolver): string[] {
    return [buildExtensionGlob(resolver.extensions()), ...(config.content ?? [])];
}

export async function scanProjectCSS(
    config: InternalConfig,
    paths: string[] = [],
    resolver: SyntaxResolver = createSyntaxResolver(),
): Promise<ProjectScan> {
    const generated = [
        resolve(process.cwd(), config.variables.path),
        resolve(process.cwd(), config.utilities.path),
    ];

    const candidates = await glob(paths.length > 0 ? paths : discoveryPatterns(config, resolver), {
        cwd: process.cwd(),
        absolute: true,
        caseSensitiveMatch: false,
        ignore: [...IGNORED_DIR_GLOBS, ...generated],
    });
    // I noticed that multi-extension brace patterns come back in an unstable order,
    // so we sort them to make the output stable in case the user wants to diff reports.
    candidates.sort();

    const files: string[] = [];
    const declared = new Set<string>();
    const used: VarRef[] = [];

    for (const file of candidates) {
        const resolution = resolver.resolve(file);
        if (resolution.kind === "unsupported") continue;

        const css = await readFile(file, "utf-8");
        const result = scanCSS(css, file, resolution.parse);
        for (const name of result.declared) declared.add(name);
        used.push(...result.used);
        files.push(file);
    }

    return { files, declared, used };
}
