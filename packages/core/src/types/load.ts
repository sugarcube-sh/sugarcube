import type { BaseError } from "./errors.js";

/** In-memory token data keyed by file path. */
export type TokenMemoryData = Record<
    string,
    {
        context?: string;
        content: string;
    }
>;

export type LoadError = BaseError & {
    file: string;
};
