import type { DiagnosticDetailByKind, DiagnosticKind, Input } from "../model.js";
import { namedPath, toReferenceTarget } from "../values/references.js";
import { relatedMessages } from "../error-messages.js";
import { type DiagnosticExtra, diagnostic, type Problems } from "./diagnostics.js";
import { malformation } from "./malformed-pointer.js";
import { type Merged, type MergedGroup, removeGroup } from "./merge.js";
import { tokenPath } from "../path.js";
import { reachOf, refObjectMeaning } from "./ref-meaning.js";

type Extending = MergedGroup & { extends: NonNullable<MergedGroup["extends"]> };

export function applyExtends(merged: Merged, input: Input, diagnostics: Problems): void {
    const state = new Map<string, "extending" | "done" | "in-a-loop">();
    const report = <K extends DiagnosticKind>(
        kind: K,
        detail: DiagnosticDetailByKind[K],
        group: Extending,
        extra: Omit<DiagnosticExtra, "span" | "path"> = {},
    ) =>
        diagnostics.found(
            diagnostic(kind, detail, { span: group.extends.span, path: group.path, ...extra }),
            input,
        );

    const visit = (group: Extending, chain: Extending[]): void => {
        const status = state.get(group.path);
        if (status === "done" || status === "in-a-loop") return;
        if (status === "extending") {
            const loop = chain.slice(chain.indexOf(group));
            const paths = [...loop.map(({ path }) => path), group.path];
            report("circular-reference", { chain: paths }, group, {
                relatedInformation: loop.slice(1).map((each) => ({
                    message: relatedMessages.partOfTheLoop,
                    span: each.extends.span,
                    path: each.path,
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
        const { keyword, reference, steps } = group.extends;
        const written = toReferenceTarget(reference);
        const direct = namedPath(reference);
        if (steps && direct === undefined) {
            report("circular-reference", { chain: [group.path], toTopLevel: true }, group);
            state.set(group.path, "in-a-loop");
            return;
        }
        if (direct !== undefined && tokenPath.contains(direct, group.path)) {
            report("circular-reference", { chain: [group.path, direct] }, group);
            state.set(group.path, "in-a-loop");
            return;
        }
        if (direct !== undefined) extendInside(direct, chain);
        if (state.get(group.path) === "in-a-loop") return;

        const reached = reachOf(group.extends, merged);
        const malformed = reached.kind === "nothing" && malformation(written, merged);
        if (malformed) {
            report("malformed-pointer", malformed, group);
        } else if (reached.kind === "nothing") {
            report("missing-reference", { ref: written, from: [group.path] }, group);
        } else if (reached.kind === "group") {
            group.extendsGroup = reached.path;
            inherit(merged, group, reached.path);
        } else if (keyword === "$ref" && refObjectMeaning(reached) === "token") {
            becomeToken(merged, group, input, diagnostics);
        } else {
            report("not-a-group", { ref: written }, group);
        }
    };

    const extendInside = (path: string, chain: Extending[]): void => {
        for (const each of Array.from(merged.groups.values())) {
            if (tokenPath.contains(path, each.path) && isExtending(each)) visit(each, chain);
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
    group.takesFrom ??= from;
    const moved = (path: string) => {
        const rest = tokenPath.relative(from, path);
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

    for (const appeared of Array.from(merged.order)) {
        const path = moved(appeared);
        if (path === undefined) continue;
        const each = merged.groups.get(appeared);
        const token = merged.tokens.get(appeared);
        if (token) {
            if (merged.tokens.has(path) || merged.groups.has(path) || underLocalToken(path))
                continue;
            const { replaces: _replaces, ...copied } = token;
            merged.tokens.set(path, { ...copied, path, inherited: { from } });
            merged.order.add(path);
            continue;
        }
        if (!each) continue;
        const existing = merged.groups.get(path);
        if (existing) existing.takesFrom ??= appeared;
        else if (!merged.tokens.has(path) && !underLocalToken(path)) {
            merged.groups.set(path, {
                path,
                declaredIn: [],
                takesFrom: appeared,
                inherited: { from },
            });
            merged.order.add(path);
        }
    }
}

function becomeToken(merged: Merged, group: Extending, input: Input, diagnostics: Problems): void {
    const { path, extends: extending, type, description, deprecated, extensions } = group;
    const inside = (each: string) => tokenPath.relative(path, each) !== undefined;
    if ([...merged.tokens.keys(), ...merged.groups.keys()].some(inside)) {
        diagnostics.found(
            diagnostic(
                "token-and-group",
                { reason: "ref", ref: toReferenceTarget(extending.reference) },
                { span: extending.span, path },
            ),
            input,
        );
    }
    removeGroup(merged, path);
    merged.tokens.set(path, {
        path,
        json: extending.json,
        value: extending.node,
        authored: { $ref: toReferenceTarget(extending.reference) },
        reference: extending.reference,
        span: extending.groupSpan,
        source: extending.source,
        ...(type !== undefined && { type }),
        ...(description !== undefined && { description }),
        ...(deprecated !== undefined && { deprecated }),
        ...(extensions && { extensions }),
    });
}
