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

/** A file, plus a JSON pointer when only part of it was read. */
export type SourceRef = {
    file: string;
    pointer?: string;
};

export type SourceOrder = {
    context: string;
    sources: SourceRef[];
};

/** File text keyed by path, and the order each context reads them in. */
export type TokenSources = {
    files: Record<string, string>;
    order: SourceOrder[];
};
