import { readFile } from "node:fs/promises";
import type { InternalConfig } from "@sugarcube-sh/core";
import { dirname, join, relative, resolve } from "pathe";
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

export interface UnreadStylesheets {
    dir: string;
    count: number;
}

function discoveryPatterns(config: InternalConfig, resolver: SyntaxResolver): string[] {
    return [buildExtensionGlob(resolver.extensions()), ...(config.content ?? [])];
}

function generatedPaths(config: InternalConfig): string[] {
    const permutations = config.variables.permutations ?? [];
    const variables =
        permutations.length > 0
            ? permutations.map((permutation) => permutation.path ?? config.variables.path)
            : [config.variables.path];

    return [...new Set([...variables, config.utilities.path])].map((path) =>
        resolve(process.cwd(), path),
    );
}

function isInside(dir: string, parent: string): boolean {
    return dir === parent || dir.startsWith(`${parent}/`);
}

export async function findUnreadStylesheets(
    config: InternalConfig,
    scanned: string[],
    resolver: SyntaxResolver = createSyntaxResolver(),
): Promise<UnreadStylesheets[]> {
    const cwd = resolve(process.cwd());
    const read = new Set(scanned);
    const stylesheets = buildExtensionGlob(resolver.extensions());
    const candidateDirs = [...new Set(generatedPaths(config).map(dirname))]
        .filter((dir) => !isInside(dir, cwd))
        .sort();

    const outputDirs = candidateDirs.filter(
        (dir) => !candidateDirs.some((other) => other !== dir && isInside(dir, other)),
    );

    const entries: UnreadStylesheets[] = [];

    for (const dir of outputDirs) {
        const found = await glob([join(dir, stylesheets)], {
            cwd,
            absolute: true,
            caseSensitiveMatch: false,
            ignore: [...IGNORED_DIR_GLOBS, ...generatedPaths(config)],
        });

        const unread = found.filter((file) => !read.has(file));
        if (unread.length > 0) entries.push({ dir: relative(cwd, dir), count: unread.length });
    }

    return entries;
}

export async function scanProjectCSS(
    config: InternalConfig,
    paths: string[] = [],
    resolver: SyntaxResolver = createSyntaxResolver(),
): Promise<ProjectScan> {
    const candidates = await glob(paths.length > 0 ? paths : discoveryPatterns(config, resolver), {
        cwd: process.cwd(),
        absolute: true,
        caseSensitiveMatch: false,
        ignore: [...IGNORED_DIR_GLOBS, ...generatedPaths(config)],
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
