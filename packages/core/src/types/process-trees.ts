import type { ResolvedTokens } from "./resolve.js";

export type ProcessedTree = {
    context?: string;
    tokens: ResolvedTokens;
};
