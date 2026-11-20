import type { DesignTokens } from "../model/design-tokens.js";
import type { SourceLine, Span } from "../model/location.js";

/**
 * Gets the line a span starts on, and where the span sits on it.
 *
 * It's `undefined` when the read has no text for the span's file.
 *
 * @param tokens - The read the span is from.
 * @param span - Where in the file, such as a diagnostic's `span`.
 *
 * @example
 * // color.blue.500 written as a hex string
 * getSourceLine(tokens, diagnostic.span)
 * // => { line: 5, text: '        "$value": "#3366cc",', column: 19, length: 9 }
 */
export function getSourceLine(tokens: DesignTokens, span: Span): SourceLine | undefined {
    const text = tokens.getText(span.file);
    if (text === undefined) return undefined;
    const { offset, length, start } = span;
    const lineStart = offset - (start.column - 1);
    const breakAt = text.slice(lineStart).search(/\r\n|\r|\n/);
    const lineText =
        breakAt === -1 ? text.slice(lineStart) : text.slice(lineStart, lineStart + breakAt);
    const room = lineText.length - (start.column - 1);
    return {
        line: start.line,
        text: lineText,
        column: start.column,
        length: Math.max(1, Math.min(length, room)),
    };
}
