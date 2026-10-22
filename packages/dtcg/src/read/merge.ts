import { relatedMessages } from "../error-messages.js";
import { atOrWithin } from "../path.js";
import type { Input, Span } from "../index.js";
import { diagnostic, type Problems } from "./diagnostics.js";
import type { Inheritable } from "./inherit.js";
import type { Settings } from "./settings.js";
import type {
    ExtensionsAt,
    GroupReference,
    Properties,
    SourceContents,
    SourceGroup,
    SourceToken,
    SourceTopLevel,
} from "./walk.js";

export interface WrittenAt {
    source: number;
    span: Span;
}

export interface MergedToken extends SourceToken {
    source: number;
    replaces?: WrittenAt[];
    inherited?: { from: string };
    generated?: { from?: string; extension: readonly [string, ...string[]] };
    added?: true;
}

export interface MergedTopLevel extends Properties {
    declaredIn: WrittenAt[];
    extensionsAt?: Record<string, ExtensionsAt & { source: number; group?: string }>;
}

export interface MergedGroup extends MergedTopLevel {
    path: string;
    extends?: GroupReference & { source: number };
    extendsGroup?: string;
    takesFrom?: string;
    inherited?: { from: string };
}

export interface Merged {
    root: MergedTopLevel;
    tokens: Map<string, MergedToken>;
    groups: Map<string, MergedGroup>;
    order: Set<string>;
    children: Map<string | undefined, string[]>;
    settings: Map<MergedTopLevel, Settings>;
    inheritedAt: { [K in Inheritable]: Map<string, Settings[K]> };
}

export function merge(
    pieces: { contents: SourceContents | undefined; source: number }[],
    input: Input,
    diagnostics: Problems,
): Merged {
    const merged: Merged = {
        root: { declaredIn: [] },
        tokens: new Map(),
        groups: new Map(),
        order: new Set(),
        children: new Map(),
        settings: new Map(),
        inheritedAt: { type: new Map(), deprecated: new Map(), deprecatedAt: new Map() },
    };
    const conflict = (path: string, later: Span, earlier: Span[], earlierIs: "token" | "group") =>
        diagnostics.found(
            diagnostic(
                "token-and-group",
                { reason: "declared", here: earlierIs === "token" ? "group" : "token" },
                {
                    span: later,
                    path,
                    related: earlier.map((span) => ({
                        message: relatedMessages.declaredAs(earlierIs),
                        span,
                        path,
                    })),
                },
            ),
            input,
        );

    for (const { contents, source } of pieces) {
        if (!contents) continue;
        mergeInto(merged.root, contents.root, source);
        for (const member of contents.members) {
            if ("group" in member) {
                const { group } = member;
                merged.order.add(group.path);
                const token = merged.tokens.get(group.path);
                if (token) {
                    conflict(group.path, group.span, [token.span], "token");
                    merged.tokens.delete(group.path);
                }
                mergeGroup(merged.groups, group, source);
                continue;
            }
            const { token } = member;
            merged.order.add(token.path);
            const group = merged.groups.get(token.path);
            if (group) {
                conflict(
                    token.path,
                    token.span,
                    group.declaredIn.map(({ span }) => span),
                    "group",
                );
                removeGroup(merged, token.path);
            }
            const earlier = merged.tokens.get(token.path);
            const replaces = earlier && [
                ...(earlier.replaces ?? []),
                { source: earlier.source, span: earlier.span },
            ];
            merged.tokens.set(token.path, { ...token, source, ...(replaces && { replaces }) });
        }
    }
    return merged;
}

function mergeGroup(groups: Map<string, MergedGroup>, group: SourceGroup, source: number): void {
    const { path, extends: extending, ...rest } = group;
    const existing = groups.get(path) ?? { path, declaredIn: [] };
    mergeInto(existing, rest, source);
    if (extending) existing.extends = { ...extending, source };
    groups.set(path, existing);
}

function mergeInto(
    existing: MergedTopLevel | MergedGroup,
    written: SourceTopLevel,
    source: number,
): void {
    const { span, extensionsAt, ...properties } = written;
    mergeProperties(existing, properties);
    existing.declaredIn.push({ source, span });
    if (extensionsAt && properties.extensions) {
        const declared = {
            ...extensionsAt,
            source,
            ...("path" in existing && { group: existing.path }),
        };
        const keys = Object.keys(properties.extensions).map((key) => [key, declared]);
        existing.extensionsAt = { ...existing.extensionsAt, ...Object.fromEntries(keys) };
    }
}

export function everyGroup(merged: Merged): [path: string | undefined, MergedTopLevel][] {
    return [[undefined, merged.root], ...merged.groups.entries()];
}

function mergeProperties(target: Properties, { extensions, ...rest }: Properties): void {
    Object.assign(target, rest);
    if (extensions) target.extensions = { ...target.extensions, ...extensions };
}

export function removeGroup(merged: Merged, path: string): void {
    for (const each of merged.groups.keys()) if (atOrWithin(each, path)) merged.groups.delete(each);
    for (const each of merged.tokens.keys()) if (atOrWithin(each, path)) merged.tokens.delete(each);
}
