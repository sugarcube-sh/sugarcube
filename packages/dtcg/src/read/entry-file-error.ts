import { exceptionMessages } from "../error-messages.js";
import type { EntryFileErrorDetail } from "../model.js";

/**
 * Thrown by `readFromMemory` when it can't tell which file to start from.
 *
 * The message says why. `detail` has the facts in the message, for writing your own.
 *
 * @example
 * // Two token files, and no resolver to say how they go together
 * try {
 *     readFromMemory({ files: { "base.json": base, "dark.json": dark } });
 * } catch (error) {
 *     if (error instanceof EntryFileError) {
 *         error.detail;
 *         // => { reason: "no-resolver", files: ["base.json", "dark.json"] }
 *     }
 * }
 */
export class EntryFileError extends Error {
    readonly detail: EntryFileErrorDetail;

    constructor(detail: EntryFileErrorDetail) {
        super(exceptionMessages.entryFile(detail));
        this.name = "EntryFileError";
        this.detail = detail;
    }
}
