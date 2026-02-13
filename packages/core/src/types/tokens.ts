import type { TokenGroup } from "./dtcg.js";

/**
 * Source information for a token, tracking where it came from.
 * Used for error reporting and context-aware processing.
 */
export type TokenSource = {
    /**
     * The context name for modifier variations (e.g., "dark", "light").
     * Aligns with DTCG Resolver Module 2025.10 terminology.
     */
    context?: string;
    /** The file path where this token was defined. */
    sourcePath: string;
};

/**
 * A loaded token file with its contents and source metadata.
 * Represents a single token file after loading but before processing.
 */
export type TokenTree = {
    /**
     * The context name for modifier variations (e.g., "dark", "compact").
     * Undefined for base/default tokens.
     */
    context?: string;
    /** The token data following the W3C Design Tokens format. */
    tokens: TokenGroup;
    /** The file path where these tokens were loaded from. */
    sourcePath: string;
};

export * from "./dtcg.js";
