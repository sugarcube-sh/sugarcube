import type {
    Diagnostic,
    DesignTokens,
    JsonPath,
    JsonValue,
    Definition,
    Reference,
    Span,
} from "../model.js";
import { spanIn } from "../read/linked.js";
import { diagnosticsAtIn } from "./diagnostics.js";
import { jsonIn, jsonPathIn } from "./json-path.js";

/**
 * Where a place or a reference the design tokens hold is written, in that read's text: its file,
 * and where it starts and ends, as TypeScript's `TextSpan` or an LSP `Range` say. A place and a
 * reference hold no position of their own, so one a later read keeps, where its text did not
 * change, is found at its new position by asking that read.
 *
 * @example
 * const { file, offset } = getSpan(tokens, token.winningDefinition);
 * goTo(file, getSpan(tokens, token.references[0]).offset);
 */
export function getSpan(tokens: DesignTokens, of: Definition | Reference): Span {
    return spanIn(tokens, of);
}

/**
 * Where a place or a reference the design tokens hold is written in its file, as the keys from
 * the top of the file down, as jsonc-parser's `JSONPath`, part of a file included: what a tool
 * writing the file changes. A root token's place is its `$root`, a token a group inherits is
 * where its value is written in the group it comes from, and a token a {@link Generator} makes,
 * and its reference, are at the extension that makes it. The top of a file is `[]`. Worked out
 * from the read's text when asked, so a read that never asks pays nothing.
 *
 * @throws an `Error` for a place or reference whose position, in this read's text, writes
 * nothing: one from a read of other text.
 *
 * @example
 * getJsonPath(tokens, text.winningDefinition)  // ["color", "text"]
 * getJsonPath(tokens, text.references[0])      // ["color", "text", "$value"]
 */
export function getJsonPath(tokens: DesignTokens, of: Definition | Reference): JsonPath {
    return jsonPathIn(tokens, spanIn(tokens, of));
}

/**
 * What `file` writes at `jsonPath` in the read's text, exactly as written: the companion of
 * {@link getJsonPath}, for a tool writing the file to see what is there now. `undefined` where
 * the file writes nothing, or the read has no such file. Worked out when asked, reading each
 * file's text once for both questions.
 *
 * @example
 * getJsonAt(tokens, "color.json", ["color", "text", "$value"]) // "{color.brand}"
 */
export function getJsonAt(
    tokens: DesignTokens,
    file: string,
    jsonPath: JsonPath,
): JsonValue | undefined {
    return jsonIn(tokens, file, jsonPath);
}

/**
 * The problems written at a place in a file, or overlapping it, as an editor shows them: a place
 * of length 0 is a point, such as the cursor.
 *
 * @example
 * const here = getDiagnosticsAt(tokens, { file: "tokens.json", offset: cursor, length: 0 });
 */
export function getDiagnosticsAt(
    tokens: DesignTokens,
    place: Pick<Span, "file" | "offset" | "length">,
): readonly Diagnostic[] {
    return diagnosticsAtIn(tokens, place);
}
