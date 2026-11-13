import type { JsonValue } from "./json.js";
import type { Span } from "./location.js";

/**
 * The resolver's sets, modifiers and order.
 *
 * A set or modifier that `resolutionOrder` never uses isn't here. It's reported as a hint.
 *
 * @see {@link https://www.designtokens.org/TR/2025.10/resolver/#syntax | Resolver 4, Syntax}
 *
 * @example
 * // The modifiers
 * tokens.resolver?.modifiers.map((modifier) => modifier.name)
 * // => ["mode"]
 */
export interface Resolver {
    /** The resolver file, as {@link DesignTokens.files} names it. */
    readonly file: string;
    /** The spec version the resolver declares, such as `"2025.10"`. */
    readonly version?: string;
    readonly name?: string;
    readonly description?: string;
    /** The sets `resolutionOrder` uses, in the order written. */
    readonly sets: readonly ResolverSet[];
    /** The modifiers `resolutionOrder` uses, in the order written. */
    readonly modifiers: readonly ResolverModifier[];
    /**
     * `resolutionOrder`, with each item as its name, such as `{ set: "base" }`.
     *
     * @see {@link https://www.designtokens.org/TR/2025.10/resolver/#resolution-order | Resolver 4.1.6, Resolution Order}
     */
    readonly resolutionOrder: readonly ({ readonly set: string } | { readonly modifier: string })[];
}

/**
 * A set that `resolutionOrder` uses, such as `base`.
 *
 * Keys written beside the `$ref` that names it replace its own. If `resolutionOrder` has
 * `{ "$ref": "#/sets/palette", "description": "Core" }`, the `palette` set's description is
 * `"Core"`.
 *
 * @see {@link https://www.designtokens.org/TR/2025.10/resolver/#sets | Resolver 4.1.4, Sets}
 */
export interface ResolverSet {
    readonly name: string;
    readonly description?: string;
    /** The set's own `$extensions`, unchanged. */
    readonly extensions?: Readonly<Record<string, JsonValue>>;
    /** The set's sources, in order, as written. */
    readonly sources: readonly SourceRef[];
    /** Where the set is written, under `sets` or in `resolutionOrder`. */
    readonly span: Span;
}

/**
 * A modifier that `resolutionOrder` uses, such as `mode`.
 *
 * As for a {@link ResolverSet}, keys written beside the `$ref` that names it replace its own.
 *
 * @see {@link https://www.designtokens.org/TR/2025.10/resolver/#modifiers | Resolver 4.1.5, Modifiers}
 */
export interface ResolverModifier {
    readonly name: string;
    readonly description?: string;
    /** The modifier's own `$extensions`, unchanged. */
    readonly extensions?: Readonly<Record<string, JsonValue>>;
    /** The modifier's contexts, in the order written. */
    readonly contexts: readonly ResolverContext[];
    /**
     * The context used when an input leaves the modifier out, such as `"light"`.
     *
     * @see {@link https://www.designtokens.org/TR/2025.10/resolver/#default | Resolver 4.1.5.3, Default}
     */
    readonly default?: string;
    /** Where the modifier is written, under `modifiers` or in `resolutionOrder`. */
    readonly span: Span;
}

/**
 * One of a modifier's contexts, such as `dark`.
 *
 * @see {@link https://www.designtokens.org/TR/2025.10/resolver/#contexts | Resolver 4.1.5.1, Contexts}
 */
export interface ResolverContext {
    readonly name: string;
    /** The modifier it belongs to. */
    readonly modifier: ResolverModifier;
    /** The context's sources, in order, as written. */
    readonly sources: readonly SourceRef[];
    /**
     * `true` for its modifier's `default` context.
     *
     * A modifier doesn't have to have a default. Then none of its contexts is.
     */
    readonly isDefault: boolean;
    /** Where the context is written. */
    readonly span: Span;
}

/**
 * A source as the resolver writes it.
 *
 * It's a file, part of one, or a set. For example, `{ file: "dark.json" }`,
 * `{ file: "all.json", pointer: "#/dark" }` or `{ set: "base" }`.
 */
export type SourceRef =
    | { readonly file: string; readonly pointer?: string }
    | { readonly set: string };
