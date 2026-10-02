import type { Diagnostic, Document } from "../index.js";

/**
 * The diagnostics that stop a design system from being used: those with severity `"error"`, in
 * the order the read found them. Warnings and notes are left in `doc.diagnostics`.
 *
 * @example
 * if (errors(doc).length > 0) process.exitCode = 1
 */
export function errors(doc: Document): Diagnostic[] {
    return doc.diagnostics.filter((each) => each.severity === "error");
}
