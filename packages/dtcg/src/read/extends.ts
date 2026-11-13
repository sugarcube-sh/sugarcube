import type { DiagnosticDetailByKind, DiagnosticKind, Input } from "../model.js";
import { getReferencePath, toReferenceTarget } from "../values/references.js";
import { relatedMessages } from "../error-messages.js";
import { type DiagnosticExtra, diagnostic, type DiagnosticCollector } from "./diagnostics.js";
import { checkMalformedPointer } from "./malformed-pointer.js";
import type { MissingRecorder } from "./missing.js";
import type { Merged, MergedGroup, MergedToken } from "./merge.js";
import { tokenPath } from "../path.js";
import { followReference } from "./ref-meaning.js";

type ExtendingGroup = MergedGroup & { extends: NonNullable<MergedGroup["extends"]> };

export function applyExtends(
    merged: Merged,
    input: Input,
    diagnostics: DiagnosticCollector,
    missing: MissingRecorder,
): void {
    const extender = new GroupExtender(merged, input, diagnostics, missing);
    for (const group of Array.from(merged.groups.values())) {
        if (isExtending(group)) extender.visit(group, []);
    }
}

class GroupExtender {
    readonly #merged: Merged;
    readonly #input: Input;
    readonly #diagnostics: DiagnosticCollector;
    readonly #missing: MissingRecorder;
    readonly #state = new Map<string, "extending" | "done" | "in-a-loop">();

    constructor(
        merged: Merged,
        input: Input,
        diagnostics: DiagnosticCollector,
        missing: MissingRecorder,
    ) {
        this.#merged = merged;
        this.#input = input;
        this.#diagnostics = diagnostics;
        this.#missing = missing;
    }

    visit(group: ExtendingGroup, chain: ExtendingGroup[]): void {
        const status = this.#state.get(group.path);
        if (status === "done" || status === "in-a-loop") return;
        if (status === "extending") {
            this.#reportLoop(group, chain);
            return;
        }

        this.#state.set(group.path, "extending");
        this.#extend(group, [...chain, group]);
        if (this.#state.get(group.path) === "extending") this.#state.set(group.path, "done");
    }

    #extend(group: ExtendingGroup, chain: ExtendingGroup[]): void {
        const direct = getReferencePath(group.extends.reference);
        if (direct !== undefined && tokenPath.contains(direct, group.path)) {
            this.#report("circular-reference", { chain: [group.path, direct] }, group);
            this.#state.set(group.path, "in-a-loop");
            return;
        }

        if (direct !== undefined) this.#extendDescendants(direct, chain);
        if (this.#state.get(group.path) === "in-a-loop") return;

        this.#inheritFromTarget(group);
    }

    #extendDescendants(path: string, chain: ExtendingGroup[]): void {
        for (const each of Array.from(this.#merged.groups.values())) {
            if (tokenPath.contains(path, each.path) && isExtending(each)) this.visit(each, chain);
        }
    }

    #inheritFromTarget(group: ExtendingGroup): void {
        const { reference, span } = group.extends;
        const ref = toReferenceTarget(reference);
        const target = followReference(group.extends, this.#merged);
        if (target.kind === "group") {
            group.extendsGroup = target.path;
            inherit(this.#merged, group, target.path);
            return;
        }
        if (target.kind !== "nothing") {
            this.#report("not-a-group", { ref }, group);
            return;
        }

        const malformed = checkMalformedPointer(ref, this.#merged, "group");
        if (malformed) this.#report("malformed-pointer", malformed, group);
        else this.#missing.record(reference, group.path, span);
    }

    #reportLoop(group: ExtendingGroup, chain: ExtendingGroup[]): void {
        const loop = chain.slice(chain.indexOf(group));
        const paths = [...loop.map(({ path }) => path), group.path];
        const relatedInformation = loop.slice(1).map((each) => ({
            message: relatedMessages.partOfTheLoop,
            span: each.extends.span,
            path: each.path,
        }));
        this.#report("circular-reference", { chain: paths }, group, { relatedInformation });
        for (const each of loop) this.#state.set(each.path, "in-a-loop");
    }

    #report<K extends DiagnosticKind>(
        kind: K,
        detail: DiagnosticDetailByKind[K],
        group: ExtendingGroup,
        extra: Omit<DiagnosticExtra, "span" | "path"> = {},
    ): void {
        const where = { span: group.extends.span, path: group.path, ...extra };
        this.#diagnostics.add(diagnostic(kind, detail, where), this.#input);
    }
}

function isExtending(group: MergedGroup): group is ExtendingGroup {
    return group.extends !== undefined;
}

function inherit(merged: Merged, group: MergedGroup, from: string): void {
    group.inheritsFrom ??= from;
    for (const originalPath of Array.from(merged.order)) {
        const rest = tokenPath.relative(from, originalPath);
        if (rest === undefined) continue;

        const path = tokenPath.join(group.path, rest);
        const token = merged.tokens.get(originalPath);
        if (token) inheritToken(merged, group, token, path, from);
        else if (merged.groups.has(originalPath))
            inheritGroup(merged, group, originalPath, path, from);
    }
}

function inheritToken(
    merged: Merged,
    group: MergedGroup,
    token: MergedToken,
    path: string,
    from: string,
): void {
    if (merged.tokens.has(path) || merged.groups.has(path)) return;
    if (isUnderToken(merged, group, path)) return;

    const { overridden: _overridden, ...copied } = token;
    merged.tokens.set(path, { ...copied, path, inherited: { from } });
    merged.order.add(path);
}

function inheritGroup(
    merged: Merged,
    group: MergedGroup,
    originalPath: string,
    path: string,
    from: string,
): void {
    const existing = merged.groups.get(path);
    if (existing) {
        existing.inheritsFrom ??= originalPath;
        return;
    }
    if (merged.tokens.has(path) || isUnderToken(merged, group, path)) return;

    merged.groups.set(path, {
        path,
        locations: [],
        inheritsFrom: originalPath,
        inherited: { from },
    });
    merged.order.add(path);
}

function isUnderToken(merged: Merged, group: MergedGroup, path: string): boolean {
    for (
        let end = path.lastIndexOf(".");
        end > group.path.length;
        end = path.lastIndexOf(".", end - 1)
    ) {
        if (merged.tokens.has(path.slice(0, end))) return true;
    }
    return false;
}
