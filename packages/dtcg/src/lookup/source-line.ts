import type { SourceLine, Span } from "../model.js";

/**
 * Gets the line a span starts on, and where the span sits on it.
 *
 * @param span - Where in the file, such as a diagnostic's `span`.
 * @param text - The file's text, such as `tokens.toMemory().files[span.file]`.
 *
 * @example
 * // color.blue.500 written as a hex string
 * getSourceLine(diagnostic.span, text)
 * // => { line: 5, text: '        "$value": "#3366cc",', column: 19, length: 9 }
 */
export function getSourceLine(span: Span, text: string): SourceLine {
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
