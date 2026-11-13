/**
 * Keys into JSON, such as `["color", "primary", "$value"]`.
 *
 * Each step is a key, or an index into an array.
 */
export type JsonPath = readonly (string | number)[];

/**
 * A place in a file.
 *
 * `offset` and `length` count from the start of the file. `start` and `end` give the line and
 * column, from 1. All of them count UTF-16 code units, as JavaScript strings do.
 */
export interface Span {
    readonly file: string;
    readonly offset: number;
    readonly length: number;
    readonly start: { readonly line: number; readonly column: number };
    readonly end: { readonly line: number; readonly column: number };
}

/**
 * The line a span starts on, as {@link getSourceLine} returns it.
 *
 * `line` and `column` count from 1, as a {@link Span}'s do.
 */
export interface SourceLine {
    readonly line: number;
    readonly text: string;
    readonly column: number;
    readonly length: number;
}
