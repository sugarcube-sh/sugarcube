import { getSpan } from "../../lookup/editor.js";
import { type Definition, DefinitionObject, sliceSpan } from "../../model/definition.js";
import type { DesignTokens } from "../../model/design-tokens.js";
import { type Reference, getReferenceSpan } from "../../model/reference.js";
import type { Span } from "../../model/location.js";
import type { Source } from "../../model/source.js";

export interface DefinitionTracker {
    at(source: Source, span: Span, path: string): Definition;
    getList(source: Source, span: Span, path: string): Definition[];
    recordMoves(references: readonly Reference[], spans: readonly Span[]): void;
    readonly newSpans: ReadonlyMap<Definition | Reference, Span>;
}

export function createDefinitionTracker(
    texts: Readonly<Record<string, string>>,
    previous: DesignTokens | undefined,
): DefinitionTracker {
    const bySpan = new Map<Span, DefinitionObject[]>();
    const newSpans = new Map<Definition | Reference, Span>();
    const checked = new Set<readonly Reference[]>();
    const before = previous && indexDefinitions(previous);
    const findReusable = (source: Source, span: Span, path: string, text: string | undefined) => {
        if (!previous || !before) return undefined;
        for (const each of before.get(path) ?? []) {
            if (each.source !== source || !sameText(previous, each, text, span)) continue;
            if (previous.getText(span.file) !== text) DefinitionObject.setText(each, text, span);
            if (!sameSpan(DefinitionObject.getSpan(each), span)) newSpans.set(each, span);
            return each;
        }
        return undefined;
    };
    const at = (source: Source, span: Span, path: string): DefinitionObject => {
        const atSpan = bySpan.get(span);
        const found = atSpan?.find((each) => each.source === source);
        if (found) return found;
        const text = texts[span.file];
        const definition =
            findReusable(source, span, path, text) ?? new DefinitionObject(source, span, text);
        if (atSpan) atSpan.push(definition);
        else bySpan.set(span, [definition]);
        return definition;
    };
    return {
        at,
        getList: (source, span, path) => DefinitionObject.asList(at(source, span, path)),
        recordMoves: (references, spans) => {
            if (!previous || checked.has(references)) return;
            checked.add(references);
            for (const [index, reference] of references.entries()) {
                const span = spans[index];
                if (span && !sameSpan(getReferenceSpan(reference), span))
                    newSpans.set(reference, span);
            }
        },
        newSpans,
    };
}

function indexDefinitions(tokens: DesignTokens): Map<string, DefinitionObject[]> {
    const byPath = new Map<string, DefinitionObject[]>();
    const seen = new Set<{ readonly definitions: readonly Definition[] }>();
    const add = (path: string, each: { readonly definitions: readonly Definition[] }) => {
        if (seen.has(each)) return;
        seen.add(each);
        const list = byPath.get(path) ?? [];
        byPath.set(path, list);
        for (const definition of each.definitions as DefinitionObject[]) {
            if (!list.includes(definition)) list.push(definition);
        }
    };
    for (const permutation of tokens.permutations) {
        for (const token of permutation.tokens) add(token.path, token);
        for (const group of permutation.groups) add(group.path, group);
    }
    return byPath;
}

function sameText(
    previous: DesignTokens,
    definition: Definition,
    text: string | undefined,
    span: Span,
): boolean {
    const was = getSpan(previous, definition);
    const then = previous.getText(was.file);
    if (then === text) return sameOffsets(was, span);
    return sliceSpan(then, was) === sliceSpan(text, span);
}

function sameSpan(a: Span, b: Span): boolean {
    return (
        sameOffsets(a, b) &&
        a.start.line === b.start.line &&
        a.start.column === b.start.column &&
        a.end.line === b.end.line &&
        a.end.column === b.end.column
    );
}

function sameOffsets(a: Span, b: Span): boolean {
    return a.file === b.file && a.offset === b.offset && a.length === b.length;
}
