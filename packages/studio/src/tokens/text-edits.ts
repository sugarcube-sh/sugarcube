import { type Node, applyEdits, findNodeAtLocation, modify, parseTree } from "jsonc-parser";
import type { FormattingOptions } from "jsonc-parser";

export type JsonPath = Array<string | number>;

const LEADING = /^[\t ]*/;

/**
 * The step between indent levels, taken as the most common increase between
 * consecutive lines — not the indent of the first indented line, which is only
 * the step if that line happens to sit one level deep.
 *
 * A project's `.editorconfig` should win over this. Reading one needs the file
 * system, so it belongs with whoever supplies the text.
 */
export function detectFormatting(text: string): FormattingOptions {
    const steps = new Map<number, number>();
    let tabs = 0;
    let spaces = 0;
    let previous = 0;

    for (const line of text.split("\n")) {
        if (line.trim() === "") continue;

        const indent = LEADING.exec(line)?.[0] ?? "";
        if (indent.includes("\t")) tabs += 1;
        else if (indent.length > 0) spaces += 1;

        const width = indent.length;
        const step = width - previous;
        if (step > 0) steps.set(step, (steps.get(step) ?? 0) + 1);
        previous = width;
    }

    if (tabs > spaces) return { tabSize: 1, insertSpaces: false };

    let best = 2;
    let seen = 0;
    for (const [step, count] of steps) {
        if (count > seen) {
            best = step;
            seen = count;
        }
    }

    return { tabSize: best, insertSpaces: true };
}

/** The node at a path, or undefined when the text does not declare one. */
export function nodeAt(text: string, path: JsonPath): Node | undefined {
    const root = parseTree(text);
    return root === undefined ? undefined : findNodeAtLocation(root, path);
}

function edit(text: string, path: JsonPath, value: unknown): string {
    return applyEdits(
        text,
        modify(text, path, value, { formattingOptions: detectFormatting(text) }),
    );
}

export function setAt(text: string, path: JsonPath, value: unknown): string {
    return edit(text, path, value);
}

export function removeAt(text: string, path: JsonPath): string {
    return edit(text, path, undefined);
}

/**
 * Renames the key in place, leaving the value untouched. `modify` cannot do
 * this — removing and re-adding moves the entry to the end and rebuilds
 * everything under it.
 */
export function renameKeyAt(text: string, path: JsonPath, name: string): string | undefined {
    const key = nodeAt(text, path)?.parent?.children?.[0];
    if (!key) return undefined;

    return text.slice(0, key.offset) + JSON.stringify(name) + text.slice(key.offset + key.length);
}

export function reorderKeyAt(
    text: string,
    parentPath: JsonPath,
    key: string,
    toIndex: number,
): string | undefined {
    const root = parseTree(text);
    if (!root) return undefined;

    const parent = parentPath.length === 0 ? root : findNodeAtLocation(root, parentPath);
    const properties = parent?.children;
    if (!properties || properties.length === 0) return undefined;

    const from = properties.findIndex((node) => node.children?.[0]?.value === key);
    if (from === -1) return undefined;

    const to = Math.max(0, Math.min(toIndex, properties.length - 1));
    if (to === from) return text;

    const spans = properties.map((node) => ({
        start: node.offset,
        end: node.offset + node.length,
    }));
    const texts = spans.map((span) => text.slice(span.start, span.end));
    const separators = spans
        .slice(1)
        .map((span, index) => text.slice(spans[index]?.end ?? span.start, span.start));

    const [moved] = texts.splice(from, 1);
    texts.splice(to, 0, moved as string);

    const rebuilt = texts.reduce(
        (acc, each, index) => (index === 0 ? each : acc + (separators[index - 1] ?? ",") + each),
        "",
    );

    const first = spans[0]?.start ?? 0;
    const last = spans[spans.length - 1]?.end ?? 0;
    return text.slice(0, first) + rebuilt + text.slice(last);
}
