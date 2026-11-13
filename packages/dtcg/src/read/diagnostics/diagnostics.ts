import { diagnosticMessages } from "../../error-messages.js";
import type { Diagnostic, DiagnosticDetailByKind, DiagnosticKind } from "../../model/diagnostic.js";
import type { Input } from "../../model/permutation.js";
import type { Permutations } from "../../model/permutations.js";
import { isEqualJson } from "../../values/same-value.js";
import type { Mutable } from "../types.js";

export type DiagnosticExtra = Partial<
    Pick<Diagnostic, "message" | "help" | "span" | "path" | "relatedInformation" | "tags">
>;

export function diagnostic<K extends DiagnosticKind>(
    kind: K,
    detail: DiagnosticDetailByKind[K],
    extra: DiagnosticExtra = {},
): Diagnostic {
    const { severity, message, help } = diagnosticMessages[kind];
    const fix = help?.(detail);
    return {
        kind,
        severity: typeof severity === "function" ? severity(detail) : severity,
        message: message(detail),
        ...(fix !== undefined && { help: fix }),
        ...extra,
        docsUrl: getDocsLink(kind, detail),
        detail,
    } as Diagnostic;
}

function getDocsLink<K extends DiagnosticKind>(kind: K, detail: DiagnosticDetailByKind[K]): string {
    const page = `https://sugarcube.sh/errors/${kind}`;
    if (kind !== "invalid-value") return page;
    return `${page}#${(detail as DiagnosticDetailByKind["invalid-value"]).reason}`;
}

export class DiagnosticCollector {
    readonly #all: Mutable<Diagnostic>[] = [];
    readonly #bySpan = new Map<string, Diagnostic[]>();
    readonly #inputs = new Map<Diagnostic, Input[]>();

    add(problem: Diagnostic, input?: Input): Diagnostic {
        const { span } = problem;
        const spot = span === undefined ? "" : `${span.file}:${span.offset}:${span.length}`;
        const atSpan = this.#bySpan.get(spot);
        const stored = atSpan?.find((each) => isEqualJson(each, problem)) ?? problem;
        if (stored === problem) {
            if (atSpan) atSpan.push(problem);
            else this.#bySpan.set(spot, [problem]);
            this.#all.push(problem);
        }
        if (input !== undefined) this.addInput(stored, input);
        return stored;
    }

    addAll(problems: readonly Diagnostic[], input?: Input): Diagnostic[] {
        return problems.map((each) => this.add(each, input));
    }

    addInput(problem: Diagnostic, input: Input): void {
        const inputs = this.#inputs.get(problem);
        if (!inputs) this.#inputs.set(problem, [input]);
        else if (!inputs.includes(input)) inputs.push(input);
    }

    attachPermutations(permutations: Permutations): Diagnostic[] {
        for (const each of this.#all) {
            const inputs = this.#inputs.get(each) ?? [];
            each.permutations = permutations.select(({ input }) => inputs.includes(input));
        }
        return this.#all;
    }

    get list(): readonly Diagnostic[] {
        return this.#all;
    }
}

export function addPermutations(
    diagnostics: Mutable<Diagnostic>[],
    permutations: Permutations,
    entry: string,
): Diagnostic[] {
    for (const each of diagnostics) {
        each.permutations ??= findPermutationsReadingFile(each, permutations, entry);
    }
    return diagnostics;
}

function findPermutationsReadingFile(
    found: Diagnostic,
    permutations: Permutations,
    entry: string,
): Permutations {
    const file = found.kind === "file-not-found" ? found.detail.file : found.span?.file;
    if (file === undefined || file === entry) return permutations;
    return permutations.select(({ sources }) => sources.some((each) => each.file === file));
}
