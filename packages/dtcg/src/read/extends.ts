import type { DiagnosticDetailByKind, DiagnosticKind, Input } from "../model.js";
import { getReferencePath, toReferenceTarget } from "../values/references.js";
import { relatedMessages } from "../error-messages.js";
import { type DiagnosticExtra, diagnostic, type DiagnosticCollector } from "./diagnostics.js";
import { checkMalformedPointer } from "./malformed-pointer.js";
import type { MissingRecorder } from "./missing.js";
import type { Merged, MergedGroup } from "./merge.js";
import { tokenPath } from "../path.js";
import { followReference } from "./ref-meaning.js";

type ExtendingGroup = MergedGroup & { extends: NonNullable<MergedGroup["extends"]> };

export function applyExtends(
    merged: Merged,
    input: Input,
    diagnostics: DiagnosticCollector,
    missing: MissingRecorder,
): void {
    const state = new Map<string, "extending" | "done" | "in-a-loop">();
    const report = <K extends DiagnosticKind>(
        kind: K,
        detail: DiagnosticDetailByKind[K],
        group: ExtendingGroup,
        extra: Omit<DiagnosticExtra, "span" | "path"> = {},
    ) =>
        diagnostics.add(
            diagnostic(kind, detail, { span: group.extends.span, path: group.path, ...extra }),
            input,
        );

    const visit = (group: ExtendingGroup, chain: ExtendingGroup[]): void => {
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

    const extend = (group: ExtendingGroup, chain: ExtendingGroup[]): void => {
        const { reference } = group.extends;
        const written = toReferenceTarget(reference);
        const direct = getReferencePath(reference);
        if (direct !== undefined && tokenPath.contains(direct, group.path)) {
            report("circular-reference", { chain: [group.path, direct] }, group);
            state.set(group.path, "in-a-loop");
            return;
        }
        if (direct !== undefined) extendDescendants(direct, chain);
        if (state.get(group.path) === "in-a-loop") return;

        const reached = followReference(group.extends, merged);
        const malformed =
            reached.kind === "nothing" && checkMalformedPointer(written, merged, "group");
        if (malformed) {
            report("malformed-pointer", malformed, group);
        } else if (reached.kind === "nothing") {
            missing.record(reference, group.path, group.extends.span);
        } else if (reached.kind === "group") {
            group.extendsGroup = reached.path;
            inherit(merged, group, reached.path);
        } else {
            report("not-a-group", { ref: written }, group);
        }
    };

    const extendDescendants = (path: string, chain: ExtendingGroup[]): void => {
        for (const each of Array.from(merged.groups.values())) {
            if (tokenPath.contains(path, each.path) && isExtending(each)) visit(each, chain);
        }
    };

    for (const group of Array.from(merged.groups.values())) {
        if (isExtending(group)) visit(group, []);
    }
}

function isExtending(group: MergedGroup): group is ExtendingGroup {
    return group.extends !== undefined;
}

function inherit(merged: Merged, group: MergedGroup, from: string): void {
    group.inheritsFrom ??= from;
    const rebasePath = (path: string) => {
        const rest = tokenPath.relative(from, path);
        return rest === undefined ? undefined : tokenPath.join(group.path, rest);
    };
    const isUnderToken = (path: string) => {
        for (
            let end = path.lastIndexOf(".");
            end > group.path.length;
            end = path.lastIndexOf(".", end - 1)
        ) {
            if (merged.tokens.has(path.slice(0, end))) return true;
        }
        return false;
    };

    for (const originalPath of Array.from(merged.order)) {
        const path = rebasePath(originalPath);
        if (path === undefined) continue;
        const each = merged.groups.get(originalPath);
        const token = merged.tokens.get(originalPath);
        if (token) {
            if (merged.tokens.has(path) || merged.groups.has(path) || isUnderToken(path)) continue;
            const { overridden: _replaces, ...copied } = token;
            merged.tokens.set(path, { ...copied, path, inherited: { from } });
            merged.order.add(path);
            continue;
        }
        if (!each) continue;
        const existing = merged.groups.get(path);
        if (existing) existing.inheritsFrom ??= originalPath;
        else if (!merged.tokens.has(path) && !isUnderToken(path)) {
            merged.groups.set(path, {
                path,
                locations: [],
                inheritsFrom: originalPath,
                inherited: { from },
            });
            merged.order.add(path);
        }
    }
}
