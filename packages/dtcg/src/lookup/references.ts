import type {
    DesignTokens,
    Group,
    Permutation,
    Reference,
    ReferenceInPermutations,
    ReferenceOptions,
    Span,
    Token,
} from "../index.js";
import { atOrWithin } from "../path.js";
import { permutationsOf } from "../read/permutations-of.js";
import { jsonPathIn } from "./json-path.js";
import { acrossPermutations } from "../read/reference.js";
import { samePlace } from "../read/same-object.js";

interface WrittenIn {
    position: Map<Reference, number>;
    byPath: Map<string, Reference[]>;
}

const written = new WeakMap<Permutation, WrittenIn>();

export function referencedIn(
    permutation: Permutation,
    path: string,
    { chained = false }: ReferenceOptions = {},
): Reference[] {
    const { position, byPath } = writtenIn(permutation);
    const reaching = (each: string, isToken: boolean): Reference[] => {
        if (isToken) return byPath.get(each) ?? [];
        return [...byPath].flatMap(([named, references]) =>
            atOrWithin(named, each) ? references : [],
        );
    };
    const first = reaching(path, permutation.token(path) !== undefined);
    const found = new Set<Reference>(first);
    const seen = new Set([path]);
    const waiting = chained ? [first] : [];
    for (const references of waiting) {
        for (const reference of references) {
            found.add(reference);
            const { from } = reference;
            if (seen.has(from.path)) continue;
            seen.add(from.path);
            waiting.push(reaching(from.path, from.kind === "token"));
        }
    }
    return [...found].sort((a, b) => (position.get(a) ?? 0) - (position.get(b) ?? 0));
}

export function usedIn(
    permutation: Permutation,
    path: string,
    options?: ReferenceOptions,
): (Token | Group)[] {
    return [...new Set(referencedIn(permutation, path, options).map(({ from }) => from))];
}

export function referencedByIn(tokens: DesignTokens, path: string): ReferenceInPermutations[] {
    return across(tokens, (permutation) => referencedIn(permutation, path));
}

export function refersToIn(
    permutation: Permutation,
    path: string,
    { chained = false }: ReferenceOptions = {},
): Reference[] {
    const start = permutation.token(path) ?? permutation.group(path);
    if (!start) return [];
    const found: Reference[] = [];
    const seen = new Set<Token | Group>([start]);
    const waiting: (Token | Group)[] = [start];
    for (const each of waiting) {
        for (const reference of each.references) {
            found.push(reference);
            const next =
                reference.path === undefined ? undefined : permutation.token(reference.path);
            if (!chained || !next || seen.has(next)) continue;
            seen.add(next);
            waiting.push(next);
        }
    }
    return found;
}

function writtenIn(permutation: Permutation): WrittenIn {
    const cached = written.get(permutation);
    if (cached) return cached;
    const position = new Map<Reference, number>();
    const byPath = new Map<string, Reference[]>();
    const visit = (items: readonly (Token | Group)[]) => {
        for (const each of items) {
            for (const reference of each.references) {
                position.set(reference, position.size);
                if (reference.path === undefined) continue;
                const list = byPath.get(reference.path);
                if (list) list.push(reference);
                else byPath.set(reference.path, [reference]);
            }
            if (each.kind === "group") visit(each.children);
        }
    };
    visit(permutation.children);
    const built = { position, byPath };
    written.set(permutation, built);
    return built;
}

function across(
    tokens: DesignTokens,
    inPermutation: (permutation: Permutation) => Reference[],
): ReferenceInPermutations[] {
    const merged = new Map<Span, { reference: Reference; permutations: Permutation[] }[]>();
    for (const permutation of tokens.permutations) {
        for (const reference of inPermutation(permutation)) {
            const span = tokens.spanOf(reference);
            let atSpan = merged.get(span);
            if (!atSpan) merged.set(span, (atSpan = []));
            const found = atSpan.find((each) => sameReference(each.reference, reference));
            if (found) found.permutations.push(permutation);
            else atSpan.push({ reference, permutations: [permutation] });
        }
    }
    return [...merged].flatMap(([span, here]) =>
        here.map(({ reference, permutations }) =>
            acrossPermutations(
                reference,
                permutationsOf(permutations, tokens.permutations),
                span,
                () => jsonPathIn(tokens, span),
            ),
        ),
    );
}

function sameReference(a: Reference, b: Reference): boolean {
    return a.from.path === b.from.path && samePlace(a.property, b.property ?? []);
}
