import type { UnoGenerator } from "@unocss/core";
import { resolve } from "pathe";
import { type BuildResult, getTokenByVariable } from "../build.js";
import { readMarkupSources } from "../scan-markup.js";
import { type UnreadStylesheets, scanStylesheets } from "../scan-stylesheets.js";

export interface TokenUse {
    token: string;
    file: string;
    line?: number;
    var: string;
    class?: string;
}

export interface TokenUses {
    uses: TokenUse[];
    scanned: { stylesheets: string[]; markup: string[] };
    unread: UnreadStylesheets[];
}

export async function findUses(built: BuildResult): Promise<TokenUses> {
    const tokenByVariable = getTokenByVariable(built);
    const { used, files, unread } = await scanStylesheets(built);
    const varUses = used.flatMap(({ name, file, line }) => {
        const token = tokenByVariable.get(name);
        return token ? [{ token, file: resolve(file), line, var: name }] : [];
    });
    const markup = built.markupFiles.map((file) => resolve(file));
    const { uno, utilityCSS, configFile } = built;
    const classUses = uno ? await findClassUses(uno, markup, tokenByVariable) : [];
    const safelistUses =
        uno && utilityCSS && configFile
            ? await findSafelistUses(uno, utilityCSS.safelist, resolve(configFile), tokenByVariable)
            : [];
    return {
        uses: [...varUses, ...classUses, ...safelistUses],
        scanned: {
            stylesheets: files.map((file) => resolve(file)),
            markup,
        },
        unread,
    };
}

async function findClassUses(
    uno: UnoGenerator,
    markup: string[],
    tokenOf: Map<string, string>,
): Promise<TokenUse[]> {
    const sources = await readMarkupSources(markup);
    const found: TokenUse[] = [];
    for (const [index, file] of markup.entries()) {
        found.push(...(await findClassUsesInFile(file, sources[index] ?? "", uno, tokenOf)));
    }
    return found;
}

async function findClassUsesInFile(
    file: string,
    code: string,
    uno: UnoGenerator,
    tokenOf: Map<string, string>,
): Promise<TokenUse[]> {
    const found: TokenUse[] = [];
    for (const className of await uno.applyExtractors(code, file)) {
        const variables = await getClassVariables(uno, className, tokenOf);
        if (variables.length === 0) continue;
        found.push(
            ...getClassLines(code, className).flatMap((line) =>
                variables.map((variable) => toClassUse(file, className, variable, line)),
            ),
        );
    }
    return found;
}

async function findSafelistUses(
    uno: UnoGenerator,
    safelist: string[],
    file: string,
    tokenOf: Map<string, string>,
): Promise<TokenUse[]> {
    const perClass = await Promise.all(
        safelist.map(async (className) =>
            (await getClassVariables(uno, className, tokenOf)).map((variable) =>
                toClassUse(file, className, variable),
            ),
        ),
    );
    return perClass.flat();
}

function toClassUse(
    file: string,
    className: string,
    [name, token]: [string, string],
    line?: number,
): TokenUse {
    const use: TokenUse = { token, file, var: name, class: className };
    if (line !== undefined) use.line = line;
    return use;
}

async function getClassVariables(
    uno: UnoGenerator,
    className: string,
    tokenOf: Map<string, string>,
): Promise<[string, string][]> {
    const parsed = await uno.parseToken(className);
    if (!parsed?.length) return [];
    const css = parsed.map((util) => util[2]).join("\n");
    const found = new Map<string, string>();
    for (const [, name] of css.matchAll(/var\((--[^,)\s]+)/g)) {
        const token = name && tokenOf.get(name);
        if (name && token && !found.has(name)) found.set(name, token);
    }
    return [...found];
}

function getClassLines(code: string, className: string): (number | undefined)[] {
    const lines = findLines(code, className);
    return lines.length > 0 ? lines : [undefined];
}

function findLines(code: string, className: string): number[] {
    const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(?<![\\w-])${escaped}(?![\\w-])`, "g");
    const lines: number[] = [];
    for (const match of code.matchAll(pattern)) {
        lines.push(code.slice(0, match.index).split("\n").length);
    }
    return lines;
}
