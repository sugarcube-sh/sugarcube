import type {
    DesignTokens,
    Group,
    Permutation,
    Reference,
    ReferenceInPermutations,
    ReferenceOptions,
    Span,
    Token,
} from "../model.js";
import { tokenPath } from "../path.js";
import { permutationsOf } from "../read/permutations-of.js";
import { jsonPathIn } from "./json-path.js";
import { acrossPermutations } from "../read/reference.js";
import { samePlace } from "../read/same-object.js";
import { getSpan } from "./editor.js";

interface ReferenceIndex {
    position: Map<Reference, number>;
    byPath: Map<string, Reference[]>;
}

const written = new WeakMap<Permutation, ReferenceIndex>();

export function referencedIn(
    permutation: Permutation,
    path: string,
    { chained = false }: ReferenceOptions = {},
): Reference[] {
    const { position, byPath } = referenceIndex(permutation);
    const reaching = (each: string, isToken: boolean): Reference[] => {
        if (isToken) return byPath.get(each) ?? [];
        return [...byPath].flatMap(([named, references]) =>
            tokenPath.contains(each, named) ? references : [],
        );
    };
    const first = reaching(path, permutation.getToken(path) !== undefined);
    const found = new Set<Reference>(first);
    const seen = new Set([path]);
    const waiting = chained ? [first] : [];
    for (const references of waiting) {
        for (const reference of references) {
            found.add(reference);
            const { writtenIn } = reference;
            if (seen.has(writtenIn.path)) continue;
            seen.add(writtenIn.path);
            waiting.push(reaching(writtenIn.path, writtenIn.kind === "token"));
        }
    }
    return [...found].sort((a, b) => (position.get(a) ?? 0) - (position.get(b) ?? 0));
}

export function dependentsIn(
    permutation: Permutation,
    path: string,
    options?: ReferenceOptions,
): (Token | Group)[] {
    return [...new Set(referencedIn(permutation, path, options).map(({ writtenIn }) => writtenIn))];
}

export function referencesToIn(tokens: DesignTokens, path: string): ReferenceInPermutations[] {
    return across(tokens, (permutation) => referencedIn(permutation, path));
}

export function dependenciesIn(
    permutation: Permutation,
    path: string,
    { chained = false }: ReferenceOptions = {},
): (Token | Group)[] {
    const start = permutation.getTokenOrGroup(path);
    if (!start) return [];
    const found = new Set<Token | Group>();
    const followed = new Set<Token | Group>([start]);
    const waiting: (Token | Group)[] = [start];
    for (const each of waiting) {
        for (const { pointsToPath } of each.references) {
            const next =
                pointsToPath === undefined ? undefined : permutation.getTokenOrGroup(pointsToPath);
            if (!next) continue;
            found.add(next);
            if (!chained || followed.has(next)) continue;
            followed.add(next);
            waiting.push(next);
        }
    }
    return [...found];
}

function referenceIndex(permutation: Permutation): ReferenceIndex {
    const cached = written.get(permutation);
    if (cached) return cached;
    const position = new Map<Reference, number>();
    const byPath = new Map<string, Reference[]>();
    const visit = (items: readonly (Token | Group)[]) => {
        for (const each of items) {
            for (const reference of each.references) {
                position.set(reference, position.size);
                if (reference.pointsToPath === undefined) continue;
                const list = byPath.get(reference.pointsToPath);
                if (list) list.push(reference);
                else byPath.set(reference.pointsToPath, [reference]);
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
    const merged = new Map<Span, Merged[]>();
    for (const permutation of tokens.permutations) {
        for (const reference of inPermutation(permutation)) {
            const span = getSpan(tokens, reference);
            let atSpan = merged.get(span);
            if (!atSpan) merged.set(span, (atSpan = []));
            let here = atSpan.find((each) =>
                samePlace(each.reference.writtenInProperty, reference.writtenInProperty ?? []),
            );
            if (!here) {
                here = { reference, writers: new Set(), heirs: new Set(), permutations: [] };
                atSpan.push(here);
            }
            if (!here.permutations.includes(permutation)) here.permutations.push(permutation);
            const { writtenIn } = reference;
            (writtenIn.inherited ? here.heirs : here.writers).add(writtenIn.path);
        }
    }
    return [...merged].flatMap(([span, here]) =>
        here.map(({ reference, writers, heirs, permutations }) =>
            acrossPermutations(
                reference,
                [...new Set([...writers, ...heirs])],
                permutationsOf(permutations, tokens.permutations),
                span,
                () => jsonPathIn(tokens, span),
            ),
        ),
    );
}

interface Merged {
    reference: Reference;
    writers: Set<string>;
    heirs: Set<string>;
    permutations: Permutation[];
}
