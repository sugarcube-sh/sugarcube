import { hasRef, isInlineModifier } from "../../shared/guards.js";
import { isToken } from "../../shared/guards.js";
import type { TokenGroup } from "../../types/dtcg.js";
import type { InlineModifier, ResolverDocument } from "../../types/resolver.js";

export function isPrivate(node: unknown): boolean {
    if (!node || typeof node !== "object") return false;
    const ext = (node as { $extensions?: unknown }).$extensions;
    if (!ext || typeof ext !== "object") return false;
    const ns = (ext as Record<string, unknown>)["sh.sugarcube"];
    return !!ns && typeof ns === "object" && (ns as { emit?: boolean }).emit === false;
}

export function markPrivate(node: TokenGroup): TokenGroup {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(node)) {
        if ((key.startsWith("$") && key !== "$root") || !child || typeof child !== "object") {
            out[key] = child;
        } else if (isToken(child)) {
            out[key] = { ...(child as object), $emit: false };
        } else {
            out[key] = markPrivate(child as TokenGroup);
        }
    }
    return out as TokenGroup;
}

/**
 * Extracted modifier information for validation and processing.
 */
export type ExtractedModifier = {
    name: string;
    contexts: string[];
    default?: string;
    $extensions?: Record<string, unknown>;
};

export function extractModifiers(document: ResolverDocument): ExtractedModifier[] {
    const modifiers: ExtractedModifier[] = [];
    const seenNames = new Set<string>();

    for (const item of document.resolutionOrder) {
        const extracted = extractModifierFromItem(item, document, seenNames);
        if (extracted) {
            modifiers.push(extracted);
            seenNames.add(extracted.name);
        }
    }

    return modifiers;
}

function extractModifierFromItem(
    item: unknown,
    document: ResolverDocument,
    seenNames: Set<string>,
): ExtractedModifier | null {
    if (hasRef(item) && item.$ref.startsWith("#/modifiers/")) {
        return extractReferencedModifier(item.$ref, document, seenNames);
    }

    if (isInlineModifier(item)) {
        return extractInlineModifier(item as InlineModifier, seenNames);
    }

    return null;
}

function extractReferencedModifier(
    ref: string,
    document: ResolverDocument,
    seenNames: Set<string>,
): ExtractedModifier | null {
    const name = ref.split("/")[2];
    if (!name || seenNames.has(name)) return null;

    const def = document.modifiers?.[name];
    if (!def) return null;

    return {
        name,
        contexts: Object.keys(def.contexts),
        default: def.default,
        $extensions: def.$extensions,
    };
}

function extractInlineModifier(
    item: InlineModifier,
    seenNames: Set<string>,
): ExtractedModifier | null {
    if (seenNames.has(item.name)) return null;

    return {
        name: item.name,
        contexts: Object.keys(item.contexts),
        default: item.default,
        $extensions: item.$extensions,
    };
}
