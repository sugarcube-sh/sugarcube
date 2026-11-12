import type {
    Diagnostic,
    DesignTokens,
    JsonPath,
    JsonValue,
    Definition,
    Reference,
    Span,
} from "../model.js";
import { findNodeAtLocation, parse } from "jsonc-parser";
import { findJsonPath, findNode, getTree } from "./json-path.js";
import { findLineStarts, getKeyNode, toSpan } from "../read/json.js";

export const SPAN_OF = Symbol.for("@sugarcube-sh/dtcg/span-of");

/**
 * Finds where a definition or reference is written.
 *
 * After an edit, pass the new read's `tokens` to find where it is now.
 *
 * @param tokens - Tokens from the read that gave you the definition or reference.
 * @param definitionOrReference - Such as `token.winningDefinition` or `token.references[0]`.
 *
 * @example
 * // Where button.background is written
 * getSpan(tokens, light.getToken("button.background")!.winningDefinition)
 * // => {
 * //     file: "color.json",
 * //     offset: 308,
 * //     length: 49,
 * //     start: { line: 11, column: 19 },
 * //     end: { line: 11, column: 68 },
 * // }
 */
export function getSpan(tokens: DesignTokens, definitionOrReference: Definition | Reference): Span {
    return (tokens as unknown as { [SPAN_OF](of: Definition | Reference): Span })[SPAN_OF](
        definitionOrReference,
    );
}

/**
 * Finds the name a definition is written under.
 *
 * {@link getSpan} covers the whole definition. This covers only its name, such as `"background"`.
 *
 * @param tokens - Tokens from the read that gave you the definition.
 * @param definition - Such as `token.winningDefinition`.
 * @throws An `Error` if it came from a read of different text.
 *
 * @example
 * // The text of button.background's name
 * const name = getNameSpan(tokens, light.getToken("button.background")!.winningDefinition);
 * tokens.getText(name.file)?.slice(name.offset, name.offset + name.length)
 * // => '"background"'
 */
export function getNameSpan(tokens: DesignTokens, definition: Definition): Span {
    const span = getSpan(tokens, definition);
    const name = getKeyNode(findNode(tokens, span));
    const lineStarts = findLineStarts(tokens.getText(span.file) ?? "");
    return toSpan({ path: span.file, lineStarts }, name);
}

/**
 * Finds the keys to where a definition or reference is written.
 *
 * @param tokens - Tokens from the read that gave you the definition or reference.
 * @param definitionOrReference - Such as `token.winningDefinition` or `token.references[0]`.
 * @throws An `Error` if it came from a read of different text.
 *
 * @example
 * // The keys to button.background's reference
 * getJsonPath(tokens, light.getToken("button.background")!.references[0]!)
 * // => ["button", "background", "$value"]
 */
export function getJsonPath(
    tokens: DesignTokens,
    definitionOrReference: Definition | Reference,
): JsonPath {
    return findJsonPath(tokens, getSpan(tokens, definitionOrReference));
}

/**
 * Gets the JSON written at some keys in a file.
 *
 * It's as written, so references aren't followed. It returns `undefined` if nothing is there.
 *
 * @param tokens - Tokens from a read that included the file.
 * @param file - The file, such as `"color.json"`.
 * @param jsonPath - The keys, such as `["button", "background", "$value"]`, from
 * {@link getJsonPath}.
 *
 * @example
 * // The $value written for button.background
 * getJsonAt(tokens, "color.json", ["button", "background", "$value"])
 * // => "{color.primary}"
 */
export function getJsonAt(
    tokens: DesignTokens,
    file: string,
    jsonPath: JsonPath,
): JsonValue | undefined {
    const tree = getTree(tokens, file);
    const node = tree && findNodeAtLocation(tree, [...jsonPath]);
    const text = node && tokens.getText(file)?.slice(node.offset, node.offset + node.length);
    return text === undefined ? undefined : (parse(text) as JsonValue);
}

/**
 * Finds the problems at a place in a file.
 *
 * A place of length 0 is a point, such as the cursor.
 *
 * @param tokens - Tokens from a read that included the file.
 * @param place - The file, offset and length, such as
 * `{ file: "color.json", offset: 308, length: 0 }`.
 *
 * @example
 * // The problems under the cursor
 * const problems = getDiagnosticsAt(tokens, { file: "color.json", offset: cursor, length: 0 });
 */
export function getDiagnosticsAt(
    tokens: DesignTokens,
    { file, offset, length }: Pick<Span, "file" | "offset" | "length">,
): readonly Diagnostic[] {
    const end = offset + length;
    return tokens.diagnostics.filter(
        ({ span }) =>
            span !== undefined &&
            span.file === file &&
            span.offset <= end &&
            offset <= span.offset + span.length,
    );
}
