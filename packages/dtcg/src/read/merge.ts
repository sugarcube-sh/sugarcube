import { relatedMessages } from "../error-messages.js";
import type { Diagnostic, Span } from "../index.js";
import { diagnostic } from "./diagnostics.js";
import type {
    ExtensionsAt,
    GroupReference,
    Properties,
    SourceContents,
    SourceGroup,
    SourceToken,
} from "./walk.js";

export interface Piece {
    order: number;
    source: number;
}

export interface MergedToken extends SourceToken {
    piece: Piece;
    inherited?: { from: string };
    generated?: { from: string };
    added?: true;
}

export interface MergedGroup extends Properties {
    path: string;
    declaredIn: Span[];
    extends?: GroupReference & { piece: Piece };
    extensionsAt?: Record<string, ExtensionsAt & { piece: Piece }>;
    end?: { order: number; offset: number };
    inherited?: { from: string };
}

export interface Merged {
    root: MergedGroup;
    tokens: Map<string, MergedToken>;
    groups: Map<string, MergedGroup>;
}

export function merge(
    pieces: { contents: SourceContents | undefined; source: number }[],
    permutation: number,
    diagnostics: Diagnostic[],
): Merged {
    const merged: Merged = {
        root: { path: "", declaredIn: [] },
        tokens: new Map(),
        groups: new Map(),
    };
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

    for (const [order, { contents, source }] of pieces.entries()) {
        if (!contents) continue;
        const piece = { order, source };
        mergeGroupInto(merged.root, contents.root, piece);
        for (const group of contents.groups) {
            const token = merged.tokens.get(group.path);
            if (token) {
                conflict(group.at, [token.at], "token");
                merged.tokens.delete(group.path);
            }
            mergeGroup(merged.groups, group, piece);
        }
        for (const token of contents.tokens) {
            const group = merged.groups.get(token.path);
            if (group) {
                conflict(token.at, group.declaredIn, "group");
                removeGroup(merged, token.path);
            }
            merged.tokens.set(token.path, { ...token, piece });
        }
    }
    return merged;
}

function mergeGroup(groups: Map<string, MergedGroup>, group: SourceGroup, piece: Piece): void {
    const existing = groups.get(group.path) ?? { path: group.path, declaredIn: [] };
    mergeGroupInto(existing, group, piece);
    groups.set(group.path, existing);
}

function mergeGroupInto(existing: MergedGroup, group: SourceGroup, piece: Piece): void {
    const { path: _path, at, extends: extending, extensionsAt, ...properties } = group;
    mergeProperties(existing, properties);
    existing.declaredIn.push(at);
    existing.end ??= { order: piece.order, offset: at.offset + at.length };
    if (extending) existing.extends = { ...extending, piece };
    if (extensionsAt && properties.extensions) {
        const declared = { ...extensionsAt, piece };
        const keys = Object.keys(properties.extensions).map((key) => [key, declared]);
        existing.extensionsAt = { ...existing.extensionsAt, ...Object.fromEntries(keys) };
    }
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
