import { relatedMessages } from "../../error-messages.js";
import { tokenPath } from "../../path.js";
import type { Diagnostic, Input, Span } from "../../model/index.js";
import { diagnostic, type DiagnosticCollector } from "../diagnostics/diagnostics.js";
import type { Inheritable } from "./inherit.js";
import type { Settings } from "./settings.js";
import type {
    ExtensionsLocation,
    GroupReference,
    Properties,
    SourceContents,
    SourceGroup,
    SourceToken,
} from "./walk.js";

export interface SourceSpan {
    source: number;
    span: Span;
    nameSpan: Span;
}

export interface MergedToken extends SourceToken {
    source: number;
    overridden?: SourceSpan[];
    inherited?: { from: string };
    generated?: { from: string; extension: readonly [string, ...string[]] };
}

export interface MergedGroup extends Properties {
    path: string;
    locations: SourceSpan[];
    extensionLocations?: Record<string, ExtensionsLocation & { source: number; group: string }>;
    extends?: GroupReference & { source: number };
    extendsGroup?: string;
    inheritsFrom?: string;
    inherited?: { from: string };
}

export interface Merged {
    tokens: Map<string, MergedToken>;
    groups: Map<string, MergedGroup>;
    order: Set<string>;
    children: Map<string | undefined, string[]>;
    settings: Map<MergedGroup, Settings>;
    inheritanceCache: { [K in Inheritable]: Map<string, Settings[K]> };
}

export function merge(
    pieces: { contents: SourceContents | undefined; source: number }[],
    input: Input,
    diagnostics: DiagnosticCollector,
): Merged {
    const merged = createMerged();
    for (const { contents, source } of pieces) {
        if (!contents) continue;
        mergeGroup(merged.groups, contents.root, source);
        for (const member of contents.members) {
            const conflict =
                "group" in member
                    ? mergeGroupMember(merged, member.group, source)
                    : mergeToken(merged, member.token, source);
            if (conflict) diagnostics.add(conflict, input);
        }
    }
    return merged;
}

function createMerged(): Merged {
    return {
        tokens: new Map(),
        groups: new Map([["", { path: "", locations: [] }]]),
        order: new Set([""]),
        children: new Map(),
        settings: new Map(),
        inheritanceCache: { type: new Map(), deprecated: new Map(), deprecatedBy: new Map() },
    };
}

function mergeGroupMember(
    merged: Merged,
    group: SourceGroup,
    source: number,
): Diagnostic | undefined {
    merged.order.add(group.path);
    const token = merged.tokens.get(group.path);
    const conflict =
        token && conflictDiagnostic(group.path, group.nameSpan, [token.nameSpan], "token");
    if (token) merged.tokens.delete(group.path);

    mergeGroup(merged.groups, group, source);
    return conflict;
}

function mergeToken(merged: Merged, token: SourceToken, source: number): Diagnostic | undefined {
    merged.order.add(token.path);
    const group = merged.groups.get(token.path);
    const earlierSpans = group?.locations.map(({ nameSpan }) => nameSpan);
    const conflict =
        earlierSpans && conflictDiagnostic(token.path, token.nameSpan, earlierSpans, "group");
    if (group) removeGroup(merged, token.path);

    const earlier = merged.tokens.get(token.path);
    const overridden = earlier && [
        ...(earlier.overridden ?? []),
        { source: earlier.source, span: earlier.span, nameSpan: earlier.nameSpan },
    ];
    merged.tokens.set(token.path, { ...token, source, ...(overridden && { overridden }) });
    return conflict;
}

function conflictDiagnostic(
    path: string,
    later: Span,
    earlier: Span[],
    earlierIs: "token" | "group",
): Diagnostic {
    const detail = {
        reason: "declared" as const,
        declaredAs: earlierIs === "token" ? ("group" as const) : ("token" as const),
        path,
        otherFiles: [...new Set(earlier.map(({ file }) => file))],
    };
    const relatedInformation = earlier.map((span) => ({
        message: relatedMessages.declaredAs(earlierIs),
        span,
        path,
    }));
    return diagnostic("token-and-group", detail, { span: later, path, relatedInformation });
}

function mergeGroup(groups: Map<string, MergedGroup>, group: SourceGroup, source: number): void {
    const { path, extends: extending, span, nameSpan, extensionsLocation, ...properties } = group;
    const existing = groups.get(path) ?? { path, locations: [] };
    mergeProperties(existing, properties);
    existing.locations.push({ source, span, nameSpan });
    if (extensionsLocation && properties.extensions) {
        const declared = { ...extensionsLocation, source, group: path };
        const keys = Object.keys(properties.extensions).map((key) => [key, declared]);
        existing.extensionLocations = {
            ...existing.extensionLocations,
            ...Object.fromEntries(keys),
        };
    }
    if (extending) existing.extends = { ...extending, source };
    groups.set(path, existing);
}

function mergeProperties(target: Properties, { extensions, ...rest }: Properties): void {
    Object.assign(target, rest);
    if (extensions) target.extensions = { ...target.extensions, ...extensions };
}

function removeGroup(merged: Merged, path: string): void {
    for (const each of merged.groups.keys())
        if (tokenPath.contains(path, each)) merged.groups.delete(each);
    for (const each of merged.tokens.keys())
        if (tokenPath.contains(path, each)) merged.tokens.delete(each);
}
