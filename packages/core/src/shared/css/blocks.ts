import { type Permutation, referrers } from "@sugarcube-sh/dtcg";
import { stacksOn } from "../pipeline/stacks-on.js";
import type { Declaration } from "./declarations.js";
import type { Entry } from "./declare.js";

export type Supported = Declaration & { supports: NonNullable<Declaration["supports"]> };

export interface Block {
    entry: Entry;
    written: Declaration[];
    supported: Supported[];
}

export function blocks(
    toWrite: Entry[],
    { redeclare }: { redeclare: boolean },
): Map<string, Block[]> {
    const byFile = new Map<string, Block[]>();
    for (const entry of toWrite) {
        const earlier = byFile.get(entry.path) ?? [];
        const inEffect = new Map<string, Declaration>();
        for (const each of earlier.filter((block) => reaches(block.entry, entry))) {
            for (const line of each.entry.declared.declarations) inEffect.set(line.name, line);
        }
        const all = entry.declared.declarations;
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
        byFile.set(entry.path, [...earlier, { entry, written, supported }]);
    }
    return byFile;
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
    const paths = [...new Set(changed.map(({ token }) => token.path))];
    const referring = new Set(referrers(permutation, paths, { transitive: true }));
    return declared.filter(({ name, token }) => referring.has(token) && !written.has(name));
}
