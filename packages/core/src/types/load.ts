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

/** A file, and the place in it a source was read from when it is not the whole file. */
export type SourceRef = {
    file: string;
    pointer?: string;
};

/** The sources one context is composed from, in resolution order. */
export type SourceOrder = {
    context: string;
    sources: SourceRef[];
};

/** The files a document is composed from: their text, and the order each context reads them in. */
export type TokenSources = {
    files: Record<string, string>;
    order: SourceOrder[];
};
