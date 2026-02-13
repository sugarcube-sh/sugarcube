import type { ResolvedTokens } from "./resolve.js";

/**
 * Resolved tokens organized by context name.
 * Each key is a context (e.g., "default", "dark", "light")
 * and the value is the resolved tokens for that context.
 */
export type NormalizedTokens = Record<string, ResolvedTokens>;

/**
 * Result of the normalization process.
 * Contains tokens organized by context and the default context name.
 */
export type NormalizeResult = {
    /** Tokens organized by context name. */
    tokens: NormalizedTokens;
    /** The context that should use :root selector in CSS output. */
    defaultContext?: string;
};
