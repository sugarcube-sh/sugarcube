import type { JsonValue } from "./json.js";
import type { ResolverContext, ResolverModifier } from "./resolver.js";

/**
 * One source of tokens, such as `color.json`.
 *
 * It's a file, part of a file, or tokens written directly in the resolver. Each source is one
 * object, shared by every permutation that reads it.
 *
 * @see {@link https://www.designtokens.org/TR/2025.10/resolver/#sets | Resolver 4.1.4, Sets}
 *
 * @example
 * // The sources dark reads
 * dark.sources.map((source) => source.file)
 * // => ["color.json", "dark.json"]
 */
export interface Source {
    /**
     * The file the tokens are in, such as `"dark.json"`.
     *
     * For tokens written in the resolver, it's the resolver.
     */
    readonly file: string;
    /**
     * The part of the file the source is, such as `"#/dark"` for `{ "$ref": "all.json#/dark" }`.
     *
     * It's absent when the source is a whole file. Tokens written in the resolver have one too,
     * such as `"#/resolutionOrder/0/sources/1"`.
     */
    readonly pointer?: string;
    /** The modifier that lists the source (if one does). */
    readonly modifier?: ResolverModifier;
    /**
     * The sets that lead to the source, outermost first.
     *
     * If `base` lists the set `palette`, and `palette` lists `colors.json`, then
     * `colors.json`'s sets are `base`, then `palette`.
     */
    readonly sets: readonly ParentSet[];
    /**
     * The source's own `$extensions`.
     *
     * They come from one of two places, never both. If the resolver writes `$extensions` beside
     * the source's `$ref`, it's those. If not, it's the ones at the top of the file.
     *
     * @example
     * // dark.json starts { "$extensions": { "com.a": 1 }, … }
     * // and the resolver lists { "$ref": "dark.json", "$extensions": { "com.b": 2 } }
     * source.extensions
     * // => { "com.b": 2 }
     */
    readonly extensions?: Readonly<Record<string, JsonValue>>;
    /**
     * The contexts that read the source.
     *
     * @example
     * // The base set in resolutionOrder lists color.json
     * light.sources[0]!.contexts
     * // => "every-context"
     *
     * @example
     * // Only the dark context lists dark.json
     * dark.sources[1]!.contexts
     * // => [{ name: "dark", … }]
     */
    readonly contexts: "every-context" | readonly ResolverContext[];
}

/**
 * A set that a source came through, such as `base` for `color.json`.
 *
 * Its `$extensions` come from one of two places, never both. If `$extensions` are written beside
 * the `$ref` that names the set, it's those. If not, it's the set's own.
 *
 * @see {@link https://www.designtokens.org/TR/2025.10/resolver/#sets | Resolver 4.1.4, Sets} and
 * {@link https://www.designtokens.org/TR/2025.10/resolver/#extending | 4.2.2, Extending}
 *
 * @example
 * // base lists { "$ref": "#/sets/palette", "$extensions": { "com.example": { "on": false } } }
 * source.sets[1]
 * // => { name: "palette", extensions: { "com.example": { on: false } } }
 */
export interface ParentSet {
    /** The set's name, as in {@link DesignTokens.resolver}. */
    readonly name: string;
    readonly extensions?: Readonly<Record<string, JsonValue>>;
}
