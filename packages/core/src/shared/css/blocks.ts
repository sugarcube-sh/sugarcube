import {
    type Document,
    type Input,
    type Permutation,
    permutation as permutationFor,
    referrers,
} from "@sugarcube-sh/dtcg";
import type { InternalConfig } from "../../types/config.js";
import { stacksOn } from "../pipeline/stacks-on.js";
import type { Declaration } from "./declarations.js";

export interface Entry {
    permutation: Permutation;
    selector: string | string[];
    atRule?: string;
    path: string;
}

export type Supported = Declaration & { supports: NonNullable<Declaration["supports"]> };

export interface Block {
    entry: Entry;
    declared: Declaration[];
    written: Declaration[];
    supported: Supported[];
}

export function entries(doc: Document, config: InternalConfig): Entry[] {
    const listed = config.variables.permutations ?? [];
    if (listed.length === 0) {
        return doc.permutations.map((permutation) => ({
            permutation,
            selector: derivedSelector(doc, permutation.input),
            path: config.variables.path,
        }));
    }
    return listed.flatMap(({ input, selector, atRule, path }) => {
        const permutation = permutationFor(doc, input);
        if (!permutation) return [];
        return [
            {
                permutation,
                selector,
                path: path ?? config.variables.path,
                ...(atRule && { atRule }),
            },
        ];
    });
}

export function blocks(
    toWrite: Entry[],
    {
        declared,
        redeclare,
    }: { declared: (permutation: Permutation) => Declaration[]; redeclare: boolean },
): Map<string, Block[]> {
    const byFile = new Map<string, Block[]>();
    for (const entry of toWrite) {
        const earlier = byFile.get(entry.path) ?? [];
        const inEffect = new Map<string, Declaration>();
        for (const each of earlier.filter((block) => reaches(block.entry, entry))) {
            for (const line of each.declared) inEffect.set(line.name, line);
        }
        const all = declared(entry.permutation);
        const changed = all.filter((line) => changedFrom(inEffect.get(line.name), line));
        const written = redeclare
            ? [...changed, ...dependents(entry.permutation, all, changed)]
            : changed;
        const writtenNames = new Set(written.map(({ name }) => name));
        const supported = all.filter(
            (line): line is Supported =>
                line.supports !== undefined &&
                (writtenNames.has(line.name) ||
                    !sameSupports(inEffect.get(line.name), line.supports)),
        );
        byFile.set(entry.path, [...earlier, { entry, declared: all, written, supported }]);
    }
    return byFile;
}

function derivedSelector(doc: Document, input: Input): string {
    const changed = Object.entries(input).find(
        ([name, context]) => context !== doc.modifiers[name]?.default,
    );
    return changed ? `[data-${changed[0]}="${changed[1]}"]` : ":root";
}

function reaches(earlier: Entry, later: Entry): boolean {
    const reach = [earlier.selector].flat();
    const target = [later.selector].flat();
    const everyElement = reach.includes(":root") || target.every((each) => reach.includes(each));
    const everyScreen =
        earlier.atRule === undefined ||
        earlier.atRule === later.atRule ||
        stacksOn(earlier.atRule, later.atRule);
    return everyElement && everyScreen;
}

function changedFrom(earlier: Declaration | undefined, line: Declaration): boolean {
    return earlier?.value !== line.value || (earlier.supports !== undefined && !line.supports);
}

function sameSupports(
    earlier: Declaration | undefined,
    { condition, value }: Supported["supports"],
): boolean {
    return earlier?.supports?.condition === condition && earlier.supports.value === value;
}

function dependents(
    permutation: Permutation,
    declared: Declaration[],
    changed: Declaration[],
): Declaration[] {
    const written = new Set(changed.map(({ name }) => name));
    const paths = [...new Set(changed.map(({ path }) => path))];
    const referring = new Set(
        referrers(permutation, paths, { transitive: true }).map(({ path }) => path),
    );
    return declared.filter(({ name, path }) => referring.has(path) && !written.has(name));
}
