import { readFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "pathe";
import { glob } from "tinyglobby";
import type { BuildResult } from "./build.js";
import { IGNORED_DIR_GLOBS } from "./constants/markup.js";
import { buildExtensionGlob } from "./glob.js";
import { type VarReference, scanCSS } from "./scan-css.js";
import { STYLESHEET_EXTENSIONS, getParser } from "./syntaxes.js";

export interface UnreadStylesheets {
    dir: string;
    count: number;
}

interface StylesheetScan {
    files: string[];
    used: VarReference[];
    declared: Set<string>;
    unread: UnreadStylesheets[];
}

export type ScanWarning =
    | { kind: "nothing-read" }
    | { kind: "unread"; unread: UnreadStylesheets[] };

const STYLESHEETS = buildExtensionGlob(STYLESHEET_EXTENSIONS);

export async function scanStylesheets(
    built: BuildResult,
    paths: string[] = [],
): Promise<StylesheetScan> {
    const generated = getGeneratedPaths(built);
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
    const used: VarReference[] = [];
    for (const file of candidates) {
        const parse = getParser(file);
        if (!parse) continue;
        const result = scanCSS(await readFile(file, "utf-8"), file, parse);
        for (const name of result.declared) declared.add(name);
        used.push(...result.used);
        files.push(file);
    }

    const unread = paths.length > 0 ? [] : await findUnreadStylesheets(generated, files);
    return { files, used, declared, unread };
}

export function getScanWarning({
    files,
    unread,
}: Pick<StylesheetScan, "files" | "unread">): ScanWarning | undefined {
    if (files.length === 0) return { kind: "nothing-read" };
    if (unread.length > 0) return { kind: "unread", unread };
    return undefined;
}

function getGeneratedPaths({ config, declared }: BuildResult): string[] {
    const outputPaths = [...declared.entries.map(({ path }) => path), config.utilities.path];
    return [...new Set(outputPaths)].map((path) => resolve(process.cwd(), path));
}

function isInside(dir: string, parent: string): boolean {
    return dir === parent || dir.startsWith(`${parent}/`);
}

async function findUnreadStylesheets(
    generated: string[],
    scanned: string[],
): Promise<UnreadStylesheets[]> {
    const cwd = resolve(process.cwd());
    const scannedFiles = new Set(scanned);
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
        const unread = found.filter((file) => !scannedFiles.has(file));
        if (unread.length > 0) entries.push({ dir: relative(cwd, dir), count: unread.length });
    }
    return entries;
}
