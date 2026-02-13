import type { BaseError } from "./errors.js";
import type { NodeMetadata, RawTokenValue, TokenSource, TokenType } from "./tokens.js";

/**
 * A token with all references resolved to their final values.
 * Contains both the original value (which may include references)
 * and the fully resolved value.
 */
export type ResolvedToken<T extends TokenType = TokenType> = NodeMetadata & {
    /** The token type (e.g., "color", "dimension"). */
    $type: T;
    /** The original value, which may contain references like "{color.primary}". */
    $value: RawTokenValue<T>;
    /** The dot-separated path to this token (e.g., "color.primary"). */
    $path: string;
    /** Source information about where this token was defined. */
    $source: TokenSource;
    /** The original path before any processing. */
    $originalPath: string;
    /** The final value after all references have been resolved. */
    $resolvedValue: RawTokenValue<T>;
};

/**
 * A collection of resolved tokens keyed by their lookup path.
 * Includes both tokens and group metadata nodes.
 */
export type ResolvedTokens = {
    [lookupKey: string]: ResolvedToken | NodeMetadata;
};

export type ResolutionErrorType = "circular" | "missing" | "type-mismatch";

export type ResolutionError = BaseError & {
    type: ResolutionErrorType;
    path: string;
    source: TokenSource;
};
