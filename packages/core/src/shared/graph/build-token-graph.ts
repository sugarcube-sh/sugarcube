import type { Permutation } from "../../types/config.js";
import type {
    GraphContext,
    GraphContextInfo,
    NodeKind,
    TokenEdge,
    TokenGraph,
    TokenNode,
} from "../../types/graph.js";
import type { NormalizedRenderableTokens } from "../../types/render.js";
import { TOKEN_REFERENCE } from "../constants/tokens.js";
import { stripRootSuffix } from "../format-css-var-name.js";
import { isRenderableToken } from "../guards.js";

// e.g. "perm:3".
const PERM_KEY = /^perm:(\d+)$/;

const EDGE_KEY_SEP = "\0";

function extractRefs(value: unknown): string[] {
    if (typeof value === "string") {
        return [...value.matchAll(TOKEN_REFERENCE)].map((match) => match[1] as string);
    }
    if (Array.isArray(value)) return value.flatMap(extractRefs);
    if (value && typeof value === "object") return Object.values(value).flatMap(extractRefs);
    return [];
}

function nameAndGroup(path: string): { name: string; group: string } {
    const display = stripRootSuffix(path);
    const lastDot = display.lastIndexOf(".");
    if (lastDot === -1) return { name: display, group: "" };
    return { name: display.slice(lastDot + 1), group: display.slice(0, lastDot) };
}

function permutationLabel(perm: Permutation): string {
    const entries = Object.entries(perm.input ?? {});
    if (entries.length === 0) return "default";
    return entries.map(([name, value]) => `${name}: ${value}`).join(" · ");
}

function isDefaultPermutation(perm: Permutation, defaults?: Record<string, string>): boolean {
    const input = Object.entries(perm.input ?? {});
    if (input.length === 0) return true;
    if (!defaults) return false;

    return input.every(([modifier, context]) => defaults[modifier] === context);
}

/**
 * Config-supplied permutations arrive exactly as written — `load.ts` only fills inputs for the
 * ones it generates itself — so a hand-written `input: {}` selects every modifier implicitly
 * (spec §6.1) and has to be completed here. `applyDefaults` in the resolver does the same job
 * for resolution; the duplication is deliberate, because `permutationLabel` reads the *literal*
 * input so the default context still reads "default" rather than listing every modifier.
 */
function effectiveInput(
    perm: Permutation,
    defaults?: Record<string, string>,
): Record<string, string> | undefined {
    if (!defaults) return perm.input;
    return { ...defaults, ...perm.input };
}

function describeContext(
    id: string,
    permutations?: Permutation[],
    modifierDefaults?: Record<string, string>,
): GraphContextInfo {
    const match = PERM_KEY.exec(id);
    const perm = match ? permutations?.[Number(match[1])] : undefined;
    if (!perm) return { id, label: id };

    const selector = Array.isArray(perm.selector) ? perm.selector.join(", ") : perm.selector;
    const input = effectiveInput(perm, modifierDefaults);
    return { id, label: permutationLabel(perm), selector, ...(input ? { input } : {}) };
}

function findDefaultContext(
    contextKeys: string[],
    permutations?: Permutation[],
    modifierDefaults?: Record<string, string>,
): GraphContext | undefined {
    const candidates = contextKeys.filter((id) => {
        const match = PERM_KEY.exec(id);
        const perm = match ? permutations?.[Number(match[1])] : undefined;
        // A lone context with no permutation behind it is the whole output, so it is default.
        return perm ? isDefaultPermutation(perm, modifierDefaults) : contextKeys.length === 1;
    });

    return candidates.length === 1 ? candidates[0] : undefined;
}

/**
 * Build a map of which tokens point at which other tokens.
 *
 * Each token is a node; alias values like `{color.pink.600}` become edges.
 * Because tokens are already resolved per context (light/dark, brand, etc.),
 * each edge and each token's per-context details are tagged with the
 * context(s) they apply to.
 */
export interface BuildTokenGraphOptions {
    permutations?: Permutation[];
    modifierDefaults?: Record<string, string>;
}

export function buildTokenGraph(
    tokens: NormalizedRenderableTokens,
    options: BuildTokenGraphOptions = {},
): TokenGraph {
    const contextKeys = Object.keys(tokens);
    const nodes = new Map<string, TokenNode>();
    const edgeContexts = new Map<string, Set<GraphContext>>();

    for (const context of contextKeys) {
        for (const entry of Object.values(tokens[context] ?? {})) {
            if (!isRenderableToken(entry)) continue;

            const id = entry.$path;
            const refs = extractRefs(entry.$value);
            const kind: NodeKind = refs.length > 0 ? "alias" : "primitive";

            let node = nodes.get(id);
            if (!node) {
                node = {
                    id,
                    ...nameAndGroup(id),
                    type: entry.$type,
                    cssName: entry.$names.css,
                    perContext: {},
                };
                nodes.set(id, node);
            }
            node.perContext[context] = { raw: entry.$value, kind };

            for (const to of refs) {
                const key = `${id}${EDGE_KEY_SEP}${to}`;
                const set = edgeContexts.get(key);
                if (set) set.add(context);
                else edgeContexts.set(key, new Set([context]));
            }
        }
    }

    const edges: TokenEdge[] = [];
    for (const [key, ctxSet] of edgeContexts) {
        const sep = key.indexOf(EDGE_KEY_SEP);
        edges.push({
            from: key.slice(0, sep),
            to: key.slice(sep + 1),
            contexts: [...ctxSet],
        });
    }

    const contexts = contextKeys.map((id) =>
        describeContext(id, options.permutations, options.modifierDefaults),
    );
    const defaultContext = findDefaultContext(
        contextKeys,
        options.permutations,
        options.modifierDefaults,
    );

    return { contexts, nodes, edges, ...(defaultContext ? { defaultContext } : {}) };
}
