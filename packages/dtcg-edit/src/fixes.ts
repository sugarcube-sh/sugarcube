import { type Diagnostic, type Span, readFromMemory } from "@sugarcube-sh/dtcg";
import { readReference } from "@sugarcube-sh/dtcg/values";
import type { Node } from "jsonc-parser";
import { fixTitles } from "./error-messages.js";
import type { Fix, Project, TextEdit } from "./index.js";
import { inline, memberRemoval, nodeAt, refString } from "./json-text.js";

/**
 * The changes that would mend a diagnostic of this project, made from the facts the diagnostic
 * carries and the text of the files. Empty when nothing is known that would mend it.
 *
 * A safe fix, applied, leaves the place it mends reading clean and changes nothing else the
 * files mean. One that depends on other tokens, such as a pointer standing for part of a value,
 * is offered only when reading the project again with it applied shows that place clean. A fix
 * that is not safe is a likely guess, such as a similar name, for a person to confirm.
 *
 * @example
 * for (const diagnostic of project.doc.diagnostics) {
 *   for (const fix of fixesFor(project, diagnostic)) menu.add(fix.title, fix.edits);
 * }
 */
export function fixesFor(project: Project, diagnostic: Diagnostic): Fix[] {
    const fix = fixFor(project, diagnostic);
    return fix ? [fix] : [];
}

function fixFor(project: Project, diagnostic: Diagnostic): Fix | undefined {
    const { at } = diagnostic;
    if (!at) return undefined;
    const written = (span: Span) => {
        const text = project.files[span.file];
        return text === undefined ? undefined : nodeAt(text, span);
    };

    switch (diagnostic.kind) {
        case "duplicate-key": {
            const earlier = diagnostic.related?.[0]?.at;
            const edit = earlier && deletion(earlier.file, written(earlier));
            return edit && safe(fixTitles.deleteEarlier(diagnostic.detail.key), edit);
        }
        case "unknown-type": {
            const { type, similar } = diagnostic.detail;
            if (type === "") return deleteEmptyType(project, at, written(at));
            if (similar === undefined) return undefined;
            return guess(fixTitles.useSimilar(similar), [replacing(at, similar)]);
        }
        case "invalid-property": {
            const { property, reference } = diagnostic.detail;
            if (reference !== undefined) {
                return guess(fixTitles.extendsAsReference(reference), [replacing(at, reference)]);
            }
            const node = written(at);
            if (property !== "$type" || node?.type !== "null") return undefined;
            return deleteEmptyType(project, at, node);
        }
        case "hex-string-color": {
            const { value, asObject } = diagnostic.detail;
            if (written(at)?.value !== value) return undefined;
            return safe(fixTitles.hexToObject, { ...place(at), text: inline(asObject) });
        }
        case "invalid-value":
            return valueFix(project, diagnostic.detail, at, written(at)?.value);
        case "malformed-pointer": {
            const { corrected } = diagnostic.detail;
            const node = written(at);
            const ref = node && refString(node);
            if (corrected === undefined || !ref) return undefined;
            const { offset, length } = ref;
            const text = JSON.stringify(corrected);
            return safe(fixTitles.writePointer(corrected), { file: at.file, offset, length, text });
        }
        case "unknown-property": {
            const similar = "similar" in diagnostic.detail ? diagnostic.detail.similar : undefined;
            if (similar === undefined) return undefined;
            return guess(fixTitles.useSimilar(similar), [replacing(at, similar)]);
        }
        case "missing-reference": {
            const { ref, similar } = diagnostic.detail;
            if (similar === undefined) return undefined;
            const uses = [at, ...(diagnostic.related ?? []).map((related) => related.at)];
            const edits = uses
                .filter((use) => aliases(written(use)?.value, ref))
                .map((use) => replacing(use, `{${similar}}`));
            return edits.length > 0 ? guess(fixTitles.useSimilar(similar), edits) : undefined;
        }
        default:
            return undefined;
    }
}

function valueFix(
    project: Project,
    detail: Extract<Diagnostic, { kind: "invalid-value" }>["detail"],
    at: Span,
    written: unknown,
): Fix | undefined {
    switch (detail.reason) {
        case "string-with-unit": {
            const { value, asObject, type } = detail;
            if (written !== value || !asObject) return undefined;
            return safe(fixTitles.measureAsObject(type), { ...place(at), text: inline(asObject) });
        }
        case "hex-not-six-digits": {
            const { value, sixDigits } = detail;
            if (written !== value || sixDigits === undefined) return undefined;
            return safe(fixTitles.sixDigitHex(sixDigits), replacing(at, sixDigits));
        }
        case "alias-not-allowed-here": {
            const reference = readReference(detail.reference);
            if (written !== detail.reference || !reference || !("alias" in reference)) {
                return undefined;
            }
            const pointer = pointerTo(reference.alias);
            const change = { ...place(at), text: inline({ $ref: pointer }) };
            if (!readsClean(project, change)) return undefined;
            return safe(fixTitles.referenceAsPointer(pointer), change);
        }
        default:
            return undefined;
    }
}

function deleteEmptyType(project: Project, at: Span, written: Node | undefined): Fix | undefined {
    const removed = deletion(at.file, written);
    if (!removed || !readsClean(project, removed)) return undefined;
    return safe(fixTitles.deleteType, removed);
}

function readsClean(project: Project, { file, offset, length, text }: TextEdit): boolean {
    const before = project.files[file] ?? "";
    const files = {
        ...project.files,
        [file]: before.slice(0, offset) + text + before.slice(offset + length),
    };
    const [entry] = project.doc.files;
    const doc = readFromMemory({ files, ...(entry !== undefined && { entry }) }, project.options);
    const end = offset + text.length;
    return !doc.diagnostics.some(
        ({ at }) => at?.file === file && at.offset <= end && offset <= at.offset + at.length,
    );
}

function aliases(written: unknown, ref: string): boolean {
    const reference = readReference(written);
    return reference !== undefined && "alias" in reference && reference.alias === ref;
}

function pointerTo(path: string): string {
    const steps = path.split(".").map((step) => step.replaceAll("~", "~0").replaceAll("/", "~1"));
    return `#/${steps.join("/")}/$value`;
}

function deletion(file: string, written: Node | undefined): TextEdit | undefined {
    const removed = written && memberRemoval(written);
    return removed && { file, ...removed, text: "" };
}

function place({ file, offset, length }: Span): Omit<TextEdit, "text"> {
    return { file, offset, length };
}

function replacing(at: Span, value: string): TextEdit {
    return { ...place(at), text: JSON.stringify(value) };
}

function safe(title: string, change: TextEdit): Fix {
    return { title, safe: true, edits: [change] };
}

function guess(title: string, edits: TextEdit[]): Fix {
    return { title, safe: false, edits };
}
