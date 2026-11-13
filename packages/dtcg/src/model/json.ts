/** A JSON object, such as a file's top level. */
export type JsonObject = { readonly [key: string]: JsonValue };

/** Any JSON value. */
export type JsonValue =
    | string
    | number
    | boolean
    | null
    | readonly JsonValue[]
    | { readonly [key: string]: JsonValue };
