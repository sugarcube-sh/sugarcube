import type { DesignTokens, Diagnostic, Span } from "@sugarcube-sh/dtcg";
import { toJsonPointer, parseReference, toReferenceTarget } from "@sugarcube-sh/dtcg/values";
import { type Node, getNodeValue } from "jsonc-parser";
import { fixTitles } from "./error-messages.js";
import type { Fix, TextEdit } from "./index.js";
import { inline, refString, removal, spliced } from "./json-text.js";
import { nodeAt, tokenAround } from "./file-text.js";
import { getDiagnosticsAt } from "@sugarcube-sh/dtcg/editor";

/**
 * The changes that would mend a diagnostic of these design tokens, made from the facts the
 * diagnostic carries and the text of the files. Empty when nothing is known that would mend it.
 *
 * A safe fix, applied, leaves the place it mends reading clean and changes nothing else the
 * files mean. One that depends on other tokens, such as a pointer standing for part of a value,
 * is offered only when reading the design tokens again with it applied shows that place clean. A
 * fix that is not safe is a likely guess, such as a similar name, for a person to confirm.
 *
 * @example
 * for (const diagnostic of tokens.diagnostics) {
 *   for (const fix of fixesFor(tokens, diagnostic)) menu.add(fix.title, fix.edits);
 * }
 */
export function fixesFor(tokens: DesignTokens, diagnostic: Diagnostic): Fix[] {
    const fix = fixFor(tokens, diagnostic);
    return fix ? [fix] : [];
}

function fixFor(tokens: DesignTokens, diagnostic: Diagnostic): Fix | undefined {
    const { span } = diagnostic;
    if (!span) return undefined;

    switch (diagnostic.kind) {
        case "duplicate-key": {
            const earlier = diagnostic.relatedInformation?.[0]?.span;
            const edits = earlier && deletion(tokens, earlier.file, nodeAt(tokens, earlier));
            return (
                edits && {
                    title: fixTitles.deleteEarlier(diagnostic.detail.key),
                    safe: true,
                    edits,
                }
            );
        }
        case "unknown-type": {
            const { type, similar } = diagnostic.detail;
            if (type === "") return deleteEmptyType(tokens, span, nodeAt(tokens, span));
            if (similar === undefined) return undefined;
            return guess(fixTitles.useSimilar(similar), [replacing(span, similar)]);
        }
        case "invalid-property": {
            const { property, reference } = diagnostic.detail;
            if (reference !== undefined) {
                return guess(fixTitles.extendsAsReference(reference), [replacing(span, reference)]);
            }
            const node = nodeAt(tokens, span);
            if (property !== "$type" || node?.type !== "null") return undefined;
            return deleteEmptyType(tokens, span, node);
        }
        case "hex-string-color": {
            const { value, asObject } = diagnostic.detail;
            if (nodeAt(tokens, span)?.value !== value) return undefined;
            return safe(fixTitles.hexToObject, { ...range(span), text: inline(asObject) });
        }
        case "invalid-value":
            return valueFix(tokens, diagnostic.detail, span, nodeAt(tokens, span)?.value);
        case "malformed-pointer":
        case "not-a-value": {
            const { corrected } = diagnostic.detail;
            const node = nodeAt(tokens, span);
            const ref = node && refString(node);
            if (corrected === undefined || !ref) return undefined;
            const { offset, length } = ref;
            const text = JSON.stringify(corrected);
            return safe(fixTitles.writePointer(corrected), {
                file: span.file,
                offset,
                length,
                text,
            });
        }
        case "unknown-property": {
            const similar = "similar" in diagnostic.detail ? diagnostic.detail.similar : undefined;
            if (similar === undefined) return undefined;
            return guess(fixTitles.useSimilar(similar), [replacing(span, similar)]);
        }
        case "missing-reference": {
            const { ref, similar } = diagnostic.detail;
            if (similar === undefined) return undefined;
            const uses = [
                span,
                ...(diagnostic.relatedInformation ?? []).map((related) => related.span),
            ];
            const edits = uses.flatMap((use) => renamedReference(tokens, use, ref, similar));
            return edits.length > 0 ? guess(fixTitles.useSimilar(similar), edits) : undefined;
        }
        default:
            return undefined;
    }
}

function valueFix(
    tokens: DesignTokens,
    detail: Extract<Diagnostic, { kind: "invalid-value" }>["detail"],
    span: Span,
    written: unknown,
): Fix | undefined {
    switch (detail.reason) {
        case "string-with-unit": {
            const { value, asObject, type } = detail;
            if (written !== value || !asObject) return undefined;
            return safe(fixTitles.measureAsObject(type), {
                ...range(span),
                text: inline(asObject),
            });
        }
        case "hex-not-six-digits": {
            const { value, sixDigits } = detail;
            if (written !== value || sixDigits === undefined) return undefined;
            return safe(fixTitles.fullHex(sixDigits), replacing(span, sixDigits));
        }
        case "short-hex-string": {
            const { value, expanded } = detail;
            if (written !== value) return undefined;
            return safe(fixTitles.fullHex(expanded), replacing(span, expanded));
        }
        case "curly-brace-not-allowed-here": {
            const reference = parseReference(detail.reference);
            if (written !== detail.reference || reference?.syntax !== "curly-brace") {
                return undefined;
            }
            const pointer = toJsonPointer(reference);
            const change = { ...range(span), text: inline(pointer) };
            if (!readsClean(tokens, [change])) return undefined;
            return safe(fixTitles.referenceAsPointer(pointer.$ref), change);
        }
        default:
            return undefined;
    }
}

function deleteEmptyType(
    tokens: DesignTokens,
    span: Span,
    written: Node | undefined,
): Fix | undefined {
    const edits = deletion(tokens, span.file, written);
    if (!edits || !readsClean(tokens, edits)) return undefined;
    return { title: fixTitles.deleteType, safe: true, edits };
}

function readsClean(tokens: DesignTokens, edits: readonly TextEdit[]): boolean {
    const [first] = edits;
    if (!first) return true;
    const { file } = first;
    const after = tokens.reread({ [file]: spliced(tokens.getText(file) ?? "", edits) });
    const edited = Math.min(...edits.map(({ offset }) => offset));
    const token = tokenAround(tokens, file, edited);
    const start = Math.min(edited, token?.offset ?? edited);
    const grown = edits.reduce((acc, { length, text }) => acc + text.length - length, 0);
    const editedEnd = Math.max(...edits.map(({ offset, length }) => offset + length));
    const end = Math.max(editedEnd, token ? token.offset + token.length : editedEnd) + grown;
    return getDiagnosticsAt(after, { file, offset: start, length: end - start }).length === 0;
}

function renamedReference(
    tokens: DesignTokens,
    use: Span,
    ref: string,
    similar: string,
): TextEdit[] {
    const node = nodeAt(tokens, use);
    const reference = node && parseReference(getNodeValue(node));
    const text = node && refString(node);
    if (!reference || !text || toReferenceTarget(reference) !== ref) return [];
    const renamed = reference.syntax === "curly-brace" ? `{${similar}}` : similar;
    return [
        { file: use.file, offset: text.offset, length: text.length, text: JSON.stringify(renamed) },
    ];
}

function deletion(
    tokens: DesignTokens,
    file: string,
    written: Node | undefined,
): TextEdit[] | undefined {
    const text = tokens.getText(file);
    if (!written || text === undefined) return undefined;
    const edits = removal(text, written).map(({ offset, length, text: replaced }) => ({
        file,
        offset,
        length,
        text: replaced,
    }));
    return edits.length > 0 ? edits : undefined;
}

function range({ file, offset, length }: Span): Omit<TextEdit, "text"> {
    return { file, offset, length };
}

function replacing(span: Span, value: string): TextEdit {
    return { ...range(span), text: JSON.stringify(value) };
}

function safe(title: string, change: TextEdit): Fix {
    return { title, safe: true, edits: [change] };
}

function guess(title: string, edits: readonly TextEdit[]): Fix {
    return { title, safe: false, edits };
}
