import type { Diagnostic, DiagnosticDetailByKind, DiagnosticKind } from "../index.js";
import { relatedMessages } from "../error-messages.js";
import { type DiagnosticExtra, diagnostic } from "./diagnostics.js";
import { type Merged, type MergedGroup, mergeProperties, removeGroup } from "./merge.js";
import { pathBelow, within } from "../path.js";
import { reach, refObjectMeaning } from "./ref-meaning.js";

type Extending = MergedGroup & { extends: NonNullable<MergedGroup["extends"]> };

export function applyExtends(merged: Merged, permutation: number, diagnostics: Diagnostic[]): void {
    const state = new Map<string, "extending" | "done" | "in-a-loop">();
    const report = <K extends DiagnosticKind>(
        kind: K,
        detail: DiagnosticDetailByKind[K],
        group: Extending,
        extra: Omit<DiagnosticExtra, "at" | "path" | "permutation"> = {},
    ) =>
        diagnostics.push(
            diagnostic(kind, detail, {
                at: group.extends.at,
                path: group.path,
                permutation,
                ...extra,
            }),
        );

    const visit = (group: Extending, chain: Extending[]): void => {
        const status = state.get(group.path);
        if (status === "done" || status === "in-a-loop") return;
        if (status === "extending") {
            const loop = chain.slice(chain.indexOf(group));
            const paths = [...loop.map(({ path }) => path), group.path];
            report("circular-reference", { chain: paths }, group, {
                related: loop.slice(1).map((each) => ({
                    message: relatedMessages.partOfTheLoop,
                    at: each.extends.at,
                })),
            });
            for (const each of loop) state.set(each.path, "in-a-loop");
            return;
        }
        state.set(group.path, "extending");
        extend(group, [...chain, group]);
        if (state.get(group.path) === "extending") state.set(group.path, "done");
    };

    const extend = (group: Extending, chain: Extending[]): void => {
        const { keyword, written, steps } = group.extends;
        const direct = steps && !steps.includes("$value") ? steps.join(".") : undefined;
        if (direct !== undefined && within(group.path, direct)) {
            report("circular-reference", { chain: [group.path, direct] }, group);
            state.set(group.path, "in-a-loop");
            return;
        }
        if (direct !== undefined) extendInside(direct, chain);
        if (state.get(group.path) === "in-a-loop") return;

        const reached = reach(steps, merged);
        if (reached.kind === "nothing") {
            report("missing-reference", { ref: written, referencedBy: [group.path] }, group);
        } else if (reached.kind === "group") {
            inherit(merged, group, reached.path);
        } else if (keyword === "$ref" && refObjectMeaning(reached) === "token") {
            becomeToken(merged, group, permutation, diagnostics);
        } else {
            report("not-a-group", { ref: written }, group);
        }
    };

    const extendInside = (path: string, chain: Extending[]): void => {
        for (const each of Array.from(merged.groups.values())) {
            if (within(each.path, path) && isExtending(each)) visit(each, chain);
        }
    };

    for (const group of Array.from(merged.groups.values())) {
        if (isExtending(group)) visit(group, []);
    }
}

function isExtending(group: MergedGroup): group is Extending {
    return group.extends !== undefined;
}

function inherit(merged: Merged, group: MergedGroup, from: string): void {
    const target = merged.groups.get(from);
    if (target) fillIn(group, target);
    const moved = (path: string) => {
        const rest = pathBelow(path, from);
        return rest === undefined ? undefined : `${group.path}.${rest}`;
    };
    const underLocalToken = (path: string) => {
        for (
            let end = path.lastIndexOf(".");
            end > group.path.length;
            end = path.lastIndexOf(".", end - 1)
        ) {
            if (merged.tokens.has(path.slice(0, end))) return true;
        }
        return false;
    };

    for (const each of Array.from(merged.groups.values())) {
        const path = moved(each.path);
        if (path === undefined) continue;
        const existing = merged.groups.get(path);
        if (existing) fillIn(existing, each);
        else if (!merged.tokens.has(path) && !underLocalToken(path)) {
            const { type, description, deprecated, extensions, extensionsAt } = each;
            merged.groups.set(path, {
                path,
                ...(type !== undefined && { type }),
                ...(description !== undefined && { description }),
                ...(deprecated !== undefined && { deprecated }),
                ...(extensions && { extensions }),
                ...(extensionsAt && { extensionsAt }),
                declaredIn: [],
                inherited: { from },
            });
        }
    }
    for (const token of Array.from(merged.tokens.values())) {
        const path = moved(token.path);
        if (path === undefined) continue;
        if (merged.tokens.has(path) || merged.groups.has(path) || underLocalToken(path)) continue;
        merged.tokens.set(path, { ...token, path, inherited: { from } });
    }
}

function fillIn(local: MergedGroup, inherited: MergedGroup): void {
    const { type, description, deprecated, extensions, extensionsAt } = inherited;
    if (extensionsAt) local.extensionsAt = { ...extensionsAt, ...local.extensionsAt };
    mergeProperties(local, {
        ...(local.type === undefined && type !== undefined && { type }),
        ...(local.description === undefined && description !== undefined && { description }),
        ...(local.deprecated === undefined && deprecated !== undefined && { deprecated }),
        ...(extensions && { extensions: { ...extensions, ...local.extensions } }),
    });
}

function becomeToken(
    merged: Merged,
    group: Extending,
    permutation: number,
    diagnostics: Diagnostic[],
): void {
    const { path, extends: extending, type, description, deprecated, extensions } = group;
    const inside = (each: string) => pathBelow(each, path) !== undefined;
    if ([...merged.tokens.keys(), ...merged.groups.keys()].some(inside)) {
        diagnostics.push(
            diagnostic("token-and-group", {}, { at: extending.at, path, permutation }),
        );
    }
    removeGroup(merged, path);
    merged.tokens.set(path, {
        path,
        json: extending.json,
        value: extending.node,
        authored: { $ref: extending.written },
        isReference: true,
        at: extending.declaredAt,
        piece: extending.piece,
        ...(type !== undefined && { type }),
        ...(description !== undefined && { description }),
        ...(deprecated !== undefined && { deprecated }),
        ...(extensions && { extensions }),
    });
}
