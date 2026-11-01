import { diagnosticMessages } from "../error-messages.js";
import type {
    Diagnostic,
    DiagnosticDetailByKind,
    DiagnosticKind,
    Input,
    Permutations,
} from "../index.js";
import { isEqualJson } from "../values/same-value.js";
import type { Building } from "./building.js";

export type DiagnosticExtra = Partial<
    Pick<Diagnostic, "message" | "span" | "path" | "related" | "tags">
>;

export function diagnostic<K extends DiagnosticKind>(
    kind: K,
    detail: DiagnosticDetailByKind[K],
    extra: DiagnosticExtra = {},
): Diagnostic {
    const { severity, message } = diagnosticMessages[kind];
    return {
        kind,
        severity: typeof severity === "function" ? severity(detail) : severity,
        message: message(detail),
        ...extra,
        docs: docsFor(kind, detail),
        detail,
    } as Diagnostic;
}

function docsFor<K extends DiagnosticKind>(kind: K, detail: DiagnosticDetailByKind[K]): string {
    const page = `https://sugarcube.sh/errors/${kind}`;
    if (kind !== "invalid-value") return page;
    return `${page}#${(detail as DiagnosticDetailByKind["invalid-value"]).reason}`;
}

export class Problems {
    readonly #all: Building<Diagnostic>[] = [];
    readonly #atSpot = new Map<string, Diagnostic[]>();
    readonly #inputs = new Map<Diagnostic, Input[]>();

    found(problem: Diagnostic, input?: Input): Diagnostic {
        const spot = spotOf(problem);
        const here = this.#atSpot.get(spot);
        const kept = here?.find((each) => isEqualJson(each, problem)) ?? problem;
        if (kept === problem) {
            if (here) here.push(problem);
            else this.#atSpot.set(spot, [problem]);
            this.#all.push(problem);
        }
        if (input !== undefined) this.also(kept, input);
        return kept;
    }

    foundAll(problems: readonly Diagnostic[], input?: Input): Diagnostic[] {
        return problems.map((each) => this.found(each, input));
    }

    also(problem: Diagnostic, input: Input): void {
        const inputs = this.#inputs.get(problem);
        if (!inputs) this.#inputs.set(problem, [input]);
        else if (!inputs.includes(input)) inputs.push(input);
    }

    inPermutations(permutations: Permutations): Diagnostic[] {
        for (const found of this.#all) {
            const inputs = this.#inputs.get(found) ?? [];
            found.permutations = permutations.where(({ input }) => inputs.includes(input));
        }
        return this.#all;
    }

    get list(): readonly Diagnostic[] {
        return this.#all;
    }
}

function spotOf({ span }: Diagnostic): string {
    return span === undefined ? "" : `${span.file}:${span.offset}:${span.length}`;
}

export function inReadingPermutations(
    diagnostics: Building<Diagnostic>[],
    permutations: Permutations,
    entry: string,
): Diagnostic[] {
    for (const found of diagnostics) {
        found.permutations ??= permutationsWith(found, permutations, entry);
    }
    return diagnostics;
}

function permutationsWith(
    found: Diagnostic,
    permutations: Permutations,
    entry: string,
): Permutations {
    const file = found.span?.file;
    if (file === undefined || file === entry) return permutations;
    return permutations.where(({ sources }) => sources.some((each) => each.file === file));
}
