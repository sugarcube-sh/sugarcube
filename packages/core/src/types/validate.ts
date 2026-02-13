import type { InternalConfig } from "./config.js";
import type { BaseError } from "./errors.js";
import type { FlattenedToken } from "./flatten.js";
import type { NodeMetadata, RawTokenValue, TokenSource, TokenType } from "./tokens.js";

type ValidatedToken<T extends TokenType = TokenType> = FlattenedToken<T>;

type ValidatedTokens = {
    [lookupKey: string]: ValidatedToken | NodeMetadata;
};

export type ValidationError = BaseError & {
    path: string;
    source: TokenSource;
};

/** Validates a token value and returns any errors. */
export type Validator<T extends TokenType> = (
    value: RawTokenValue<T>,
    path: string,
    source: TokenSource,
    config?: InternalConfig
) => ValidationError[];
