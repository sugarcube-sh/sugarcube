import type { ResolvedTokens } from "./resolve.js";

/**
 * Resolved tokens organized by context name.
 * Each key is a context (e.g., "default", "dark", "light")
 * and the value is the resolved tokens for that context.
 */
export type NormalizedTokens = Record<string, ResolvedTokens>;
