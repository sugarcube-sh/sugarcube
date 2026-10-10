import { readFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "pathe";
import { glob } from "tinyglobby";
import type { Built } from "./build.js";
import { IGNORED_DIR_GLOBS } from "./constants/markup.js";
import { buildExtensionGlob } from "./glob.js";
import { type VarRef, scanCSS } from "./scan-css.js";
import { STYLESHEET_EXTENSIONS, parserFor } from "./syntaxes.js";

export interface UnreadStylesheets {
    dir: string;
    count: number;
}

interface Stylesheets {
    files: string[];
    used: VarRef[];
    declared: Set<string>;
    unread: UnreadStylesheets[];
}

const STYLESHEETS = buildExtensionGlob(STYLESHEET_EXTENSIONS);

export async function scanStylesheets(built: Built, paths: string[] = []): Promise<Stylesheets> {
    const generated = generatedPaths(built);
    const candidates = await glob(
        paths.length > 0 ? paths : [STYLESHEETS, ...(built.config.content ?? [])],
        {
            cwd: process.cwd(),
            absolute: true,
            caseSensitiveMatch: false,
            ignore: [...IGNORED_DIR_GLOBS, ...generated],
        },
    );
    candidates.sort();

    const files: string[] = [];
    const declared = new Set<string>();
    const used: VarRef[] = [];
    for (const file of candidates) {
        const parse = parserFor(file);
        if (!parse) continue;
        const result = scanCSS(await readFile(file, "utf-8"), file, parse);
        for (const name of result.declared) declared.add(name);
        used.push(...result.used);
        files.push(file);
    }

    const unread = paths.length > 0 ? [] : await unreadStylesheets(generated, files);
    return { files, used, declared, unread };
}

function generatedPaths({ config, declared }: Built): string[] {
    const written = [...declared.entries.map(({ path }) => path), config.utilities.path];
    return [...new Set(written)].map((path) => resolve(process.cwd(), path));
}

function isInside(dir: string, parent: string): boolean {
    return dir === parent || dir.startsWith(`${parent}/`);
}

async function unreadStylesheets(
    generated: string[],
    scanned: string[],
): Promise<UnreadStylesheets[]> {
    const cwd = resolve(process.cwd());
    const read = new Set(scanned);
    const candidateDirs = [...new Set(generated.map(dirname))]
        .filter((dir) => !isInside(dir, cwd))
        .sort();
    const outputDirs = candidateDirs.filter(
        (dir) => !candidateDirs.some((other) => other !== dir && isInside(dir, other)),
    );

    const entries: UnreadStylesheets[] = [];
    for (const dir of outputDirs) {
        const found = await glob([join(dir, STYLESHEETS)], {
            cwd,
            absolute: true,
            caseSensitiveMatch: false,
            ignore: [...IGNORED_DIR_GLOBS, ...generated],
        });
        const unread = found.filter((file) => !read.has(file));
        if (unread.length > 0) entries.push({ dir: relative(cwd, dir), count: unread.length });
    }
    return entries;
}
