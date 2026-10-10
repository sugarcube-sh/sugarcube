import type { UnoGenerator } from "@unocss/core";
import { resolve } from "pathe";
import type { Built } from "../build.js";
import { readMarkupSources } from "../scan-markup.js";
import { type UnreadStylesheets, findUnreadStylesheets, scanProjectCSS } from "../scan-project.js";

export interface Use {
    token: string;
    file: string;
    line?: number;
    var: string;
    class?: string;
}

export interface Uses {
    uses: Use[];
    scanned: { forVarReferences: string[]; forUtilityClasses: string[] };
    unread: UnreadStylesheets[];
}

export async function findUses(built: Built): Promise<Uses> {
    const tokenOf = variablesOf(built);
    const { used, files } = await scanProjectCSS(built.config);
    const fromVar = used.flatMap(({ name, file, line }) => {
        const token = tokenOf.get(name);
        return token ? [{ token, file: resolve(file), line, var: name }] : [];
    });
    const markup = built.markupFiles.map((file) => resolve(file));
    const { generator, configFile } = built;
    const fromClass = generator ? await classUses(generator.uno, markup, tokenOf) : [];
    const safelisted =
        generator && configFile
            ? await safelistUses(generator.uno, generator.safelist, resolve(configFile), tokenOf)
            : [];
    return {
        uses: [...fromVar, ...fromClass, ...safelisted],
        scanned: {
            forVarReferences: files.map((file) => resolve(file)),
            forUtilityClasses: markup,
        },
        unread: await findUnreadStylesheets(built.config, files),
    };
}

function variablesOf({ declared }: Built): Map<string, string> {
    const tokenOf = new Map<string, string>();
    for (const { declared: made } of declared.entries) {
        for (const { name, token } of made.declarations) tokenOf.set(name, token.path);
    }
    return tokenOf;
}

async function classUses(
    uno: UnoGenerator,
    markup: string[],
    tokenOf: Map<string, string>,
): Promise<Use[]> {
    const sources = await readMarkupSources(markup);
    const found: Use[] = [];
    for (const [index, file] of markup.entries()) {
        found.push(...(await classUsesIn(file, sources[index] ?? "", uno, tokenOf)));
    }
    return found;
}

async function classUsesIn(
    file: string,
    code: string,
    uno: UnoGenerator,
    tokenOf: Map<string, string>,
): Promise<Use[]> {
    const found: Use[] = [];
    for (const className of await uno.applyExtractors(code, file)) {
        const variables = await variablesIn(uno, className, tokenOf);
        if (variables.length === 0) continue;
        found.push(
            ...placesOf(code, className).flatMap((line) =>
                variables.map((variable) => classUse(file, className, variable, line)),
            ),
        );
    }
    return found;
}

async function safelistUses(
    uno: UnoGenerator,
    safelist: string[],
    file: string,
    tokenOf: Map<string, string>,
): Promise<Use[]> {
    const perClass = await Promise.all(
        safelist.map(async (className) =>
            (await variablesIn(uno, className, tokenOf)).map((variable) =>
                classUse(file, className, variable),
            ),
        ),
    );
    return perClass.flat();
}

function classUse(
    file: string,
    className: string,
    [name, token]: [string, string],
    line?: number,
): Use {
    const use: Use = { token, file, var: name, class: className };
    if (line !== undefined) use.line = line;
    return use;
}

async function variablesIn(
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

function placesOf(code: string, className: string): (number | undefined)[] {
    const lines = linesOf(code, className);
    return lines.length > 0 ? lines : [undefined];
}

function linesOf(code: string, className: string): number[] {
    const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(?<![\\w-])${escaped}(?![\\w-])`, "g");
    const lines: number[] = [];
    for (const match of code.matchAll(pattern)) {
        lines.push(code.slice(0, match.index).split("\n").length);
    }
    return lines;
}
