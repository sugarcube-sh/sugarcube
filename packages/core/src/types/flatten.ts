import type { BaseError } from "./errors.js";
import type { NodeMetadata, TokenSource, TokenType, TokenValue } from "./tokens.js";

export type FlattenedToken<T extends TokenType = TokenType> = NodeMetadata & {
    $type?: T;
    $value: TokenValue<T>;
    $path: string;
    $source: TokenSource;
    $originalPath: string;
};

export type FlattenedTokens = {
    tokens: {
        [lookupKey: string]: FlattenedToken | NodeMetadata;
    };
    /** Maps original paths to namespaced keys for O(1) lookups. */
    pathIndex: Map<string, string>;
};

export type FlattenError = BaseError & {
    path: string;
    source: TokenSource;
};
