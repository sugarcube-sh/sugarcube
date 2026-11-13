import type { Definition } from "./definition.js";
import type { JsonValue } from "./json.js";
import type { JsonPath } from "./location.js";
import type { Part } from "./part.js";
import type { Reference } from "./reference.js";
import type { TokenType, UnresolvedValue, ValueByType } from "./value.js";

/** What every token has. */
export interface TokenBase<T extends TokenType> {
    /**
     * Tells a token from a group.
     *
     * A JSON object with `$value` is a token.
     *
     * @see {@link https://www.designtokens.org/TR/2025.10/format/#group-structure | Format 6.1, Group Structure}
     */
    readonly kind: "token";
    /**
     * Where the token is, such as `"color.primary"`.
     *
     * A group's `$root` token has a path such as `"color.$root"`. That's how the spec writes a
     * reference to it.
     *
     * @see {@link https://www.designtokens.org/TR/2025.10/format/#root-tokens-in-groups | Format 6.2, Root Tokens in Groups}
     */
    readonly path: string;
    /**
     * The token's type, such as `"color"`.
     *
     * It's the token's own `$type`, or else its group's. Otherwise it's the type of the token its
     * value refers to.
     *
     * @see {@link https://www.designtokens.org/TR/2025.10/format/#type-inheritance | Format 6.7.3, Type Inheritance}
     */
    readonly type: T;
    /**
     * The value, with references as written.
     *
     * It's absent when the token is {@link TokenBase.invalid | invalid}.
     */
    readonly value?: UnresolvedValue<T>;
    /**
     * The value, with every reference followed.
     *
     * It's absent when the token is invalid, or a reference can't be followed.
     */
    readonly resolved?: ValueByType[T];
    /**
     * Set when the token's value couldn't be read.
     *
     * Why is in {@link DesignTokens.diagnostics}, under the token's path. A reference to a missing
     * token doesn't make it invalid. Its `resolved` is just absent.
     */
    readonly invalid?: true;
    /** The token's `$description`. */
    readonly description?: string;
    /**
     * `true`, or a message saying what to use instead.
     *
     * It can come from the token's group. It's absent when the token isn't deprecated, even if it
     * writes `"$deprecated": false`.
     *
     * @see {@link https://www.designtokens.org/TR/2025.10/format/#deprecated | Format 5.2.4, Deprecated}
     */
    readonly deprecated?: true | string;
    /**
     * The group whose `$deprecated` applies to this token.
     *
     * It's the nearest group above with one, written itself or through `$extends`; `""` when it's the
     * top of the file. It's absent when the token writes its own, or when there's none.
     */
    readonly deprecatedByGroup?: string;
    /**
     * The token's `$extensions`, unchanged.
     *
     * Like any JavaScript object, it puts whole-number keys first.
     */
    readonly extensions?: Readonly<Record<string, JsonValue>>;
    /**
     * Every place a file writes the token, in the order read.
     *
     * Usually there's one. When several files write it, the last one read wins. A token from
     * `$extends` is written in the group it comes from. A token a {@link Generator} makes is
     * written as the generator's settings in `$extensions`.
     *
     * @see {@link https://www.designtokens.org/TR/2025.10/resolver/#ordering | Resolver 6.2, Ordering}
     *
     * @example
     * // In dark, color.json and dark.json both write color.primary
     * dark.getToken("color.primary")!.definitions.map((d) => d.source.file)
     * // => ["color.json", "dark.json"]
     */
    readonly definitions: readonly Definition[];
    /**
     * What the file writes for the token's value, `$type` and `$deprecated`.
     *
     * `$type` and `$deprecated` are here only when the token writes them itself. It's absent for a
     * token a {@link Generator} adds.
     *
     * @example
     * // color.primary in dark writes its own $type
     * dark.getToken("color.primary")!.original
     * // => { value: "{color.blue.300}", type: "color" }
     */
    readonly original?: { readonly value: JsonValue } & Pick<
        OriginalProperties,
        "type" | "deprecated"
    >;
    /**
     * Set when a {@link Generator} makes the token.
     *
     * `from` is the group with the extension, `""` at the top of a file. `extension` is where the
     * generator's settings are in its `$extensions`, such as `["com.example", "steps"]`.
     */
    readonly generated?: {
        readonly from: string;
        readonly extension: readonly [string, ...string[]];
    };
    /**
     * Set when the token is here only through `$extends`.
     *
     * `from` is the group it comes from.
     */
    readonly inherited?: { readonly from: string };
    /**
     * Each reference in the token's value, in the order written.
     *
     * They're kept even when the value can't be read.
     *
     * @example
     * // button.background
     * light.getToken("button.background")!.references.map((r) => r.pointsToPath)
     * // => ["color.primary"]
     */
    readonly references: readonly Reference[];
    /**
     * Gets the reference written at a place in the value.
     *
     * Without `property`, it's the reference written as the whole value. It returns `undefined` if
     * a value is written there.
     *
     * @param property - Where in the value, such as `["color"]` for a border's color.
     *
     * @example
     * // button.background's whole value is a reference
     * light.getToken("button.background")!.getReferenceAt()?.pointsToPath
     * // => "color.primary"
     */
    getReferenceAt(property?: JsonPath): Reference | undefined;
    /**
     * The token, then each token its value refers to, in turn.
     *
     * It ends at the token with an actual value. It only follows references to a whole value. It
     * stops at a missing token or a loop.
     *
     * @example
     * // button.background in dark
     * dark.getToken("button.background")!.aliasChain.map((t) => t.path)
     * // => ["button.background", "color.primary", "color.blue.300"]
     */
    readonly aliasChain: readonly Token[];
    /**
     * Where this token's value comes from.
     *
     * When several files write the token, the last one read wins. This is that one, the last of
     * {@link TokenBase.definitions | definitions}.
     *
     * @see {@link https://www.designtokens.org/TR/2025.10/resolver/#ordering | Resolver 6.2, Ordering}
     *
     * @example
     * // In dark, color.primary comes from dark.json
     * dark.getToken("color.primary")!.winningDefinition.source.file
     * // => "dark.json"
     */
    readonly winningDefinition: Definition;
    /**
     * The token's value, split into its parts.
     *
     * Each part has its value with references followed, and any reference written there. It's
     * `undefined` when the token has no resolved value.
     *
     * @example
     * // button.background refers to color.primary
     * dark.getToken("button.background")!.parts?.ref?.pointsToPath
     * // => "color.primary"
     */
    readonly parts: Part | undefined;
}

/**
 * A design token.
 *
 * Check `type`, and TypeScript knows the shape of `value` and `resolved`.
 *
 * @example
 * // A color token's color space
 * const token = light.getToken("color.blue.500")!;
 * if (token.type === "color") token.resolved?.colorSpace;
 * // => "srgb"
 */
export type Token = { [T in TokenType]: TokenBase<T> }[TokenType];

/**
 * What a token or group writes on itself.
 *
 * It leaves out what comes from its group, or from a group it extends.
 */
export interface OriginalProperties {
    readonly type?: TokenType;
    readonly description?: string;
    readonly deprecated?: boolean | string;
    readonly extensions?: Readonly<Record<string, JsonValue>>;
}
