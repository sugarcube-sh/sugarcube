import { relatedMessages } from "../error-messages.js";
import type { Diagnostic, Span } from "../index.js";
import { diagnostic } from "./diagnostics.js";
import type {
    GroupReference,
    Properties,
    SourceContents,
    SourceGroup,
    SourceToken,
} from "./walk.js";

export interface MergedToken extends SourceToken {
    index: number;
    inherited?: { from: string };
}

export interface MergedGroup extends Properties {
    path: string;
    declaredIn: Span[];
    extends?: GroupReference & { index: number };
    inherited?: { from: string };
}

export interface Merged {
    root: Properties;
    tokens: Map<string, MergedToken>;
    groups: Map<string, MergedGroup>;
}

export function merge(
    sources: (SourceContents | undefined)[],
    permutation: number,
    diagnostics: Diagnostic[],
): Merged {
    const merged: Merged = { root: {}, tokens: new Map(), groups: new Map() };
    const conflict = (later: Span, earlier: Span[], earlierIs: "token" | "group") =>
        diagnostics.push(
            diagnostic(
                "token-and-group",
                {},
                {
                    at: later,
                    permutation,
                    related: earlier.map((at) => ({
                        message: relatedMessages.declaredAs(earlierIs),
                        at,
                    })),
                },
            ),
        );

    for (const [index, source] of sources.entries()) {
        if (!source) continue;
        mergeProperties(merged.root, source.root);
        for (const group of source.groups) {
            const token = merged.tokens.get(group.path);
            if (token) {
                conflict(group.at, [token.at], "token");
                merged.tokens.delete(group.path);
            }
            mergeGroup(merged.groups, group, index);
        }
        for (const token of source.tokens) {
            const group = merged.groups.get(token.path);
            if (group) {
                conflict(token.at, group.declaredIn, "group");
                removeGroup(merged, token.path);
            }
            merged.tokens.set(token.path, { ...token, index });
        }
    }
    return merged;
}

function mergeGroup(groups: Map<string, MergedGroup>, group: SourceGroup, index: number): void {
    const { path, at, extends: extending, ...properties } = group;
    const existing = groups.get(path) ?? { path, declaredIn: [] };
    mergeProperties(existing, properties);
    existing.declaredIn.push(at);
    if (extending) existing.extends = { ...extending, index };
    groups.set(path, existing);
}

export function mergeProperties(target: Properties, { extensions, ...rest }: Properties): void {
    Object.assign(target, rest);
    if (extensions) target.extensions = { ...target.extensions, ...extensions };
}

export function removeGroup(merged: Merged, path: string): void {
    const inside = (each: string) => each === path || each.startsWith(`${path}.`);
    for (const each of merged.groups.keys()) if (inside(each)) merged.groups.delete(each);
    for (const each of merged.tokens.keys()) if (inside(each)) merged.tokens.delete(each);
}
