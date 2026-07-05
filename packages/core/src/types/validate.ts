import type { BaseError } from "./errors.js";
import type { RawTokenValue, TokenSource, TokenType } from "./tokens.js";

export type ValidationError = BaseError & {
    path: string;
    source: TokenSource;
};

/** Validates a token value and returns any errors. */
export type Validator<T extends TokenType> = (
    value: RawTokenValue<T>,
    path: string,
    source: TokenSource,
    extensions?: { [key: string]: unknown }
) => ValidationError[];
