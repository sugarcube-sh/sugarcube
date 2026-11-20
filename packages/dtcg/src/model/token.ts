import type { Definition } from "./definition.js";
import type { JsonValue } from "./json.js";
import type { JsonPath } from "./location.js";
import type { Part } from "./part.js";
import type { Reference } from "./reference.js";
import type { TokenType, UnresolvedValue, ValueByType } from "./value.js";
import { buildParts } from "../lookup/parts.js";
import { samePropertyPath } from "./location.js";

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
     * Where the token's type comes from, when it doesn't write `$type` itself.
     *
     * `via` is `"group"` when a group it's inside gives it, and `path` names the group that writes
     * the `$type`, `""` for the top of the file. `via` is `"reference"` when the type comes from
     * the token its value refers to, and `path` names that token.
     *
     * @see {@link https://www.designtokens.org/TR/2025.10/format/#type-inheritance | Format 6.7.3, Type Inheritance}
     *
     * @example
     * // brand is "{color.primary}" and writes no $type
     * light.getToken("brand")!.typeFrom
     * // => { path: "color.primary", via: "reference" }
     */
    readonly typeFrom?: InheritedFrom;
    /**
     * The `$value` read and checked, with references kept. What a file may leave out is filled in,
     * such as a color's `alpha: 1`.
     *
     * It's `undefined` when the token is {@link TokenBase.invalid | invalid}.
     */
    readonly parsedValue?: UnresolvedValue<T>;
    /**
     * The value, with every reference followed.
     *
     * It's `undefined` when the token is invalid, or a reference can't be followed.
     */
    readonly resolvedValue?: ValueByType[T];
    /**
     * Set when the token's value couldn't be read.
     *
     * Why is in {@link DesignTokens.diagnostics}, under the token's path. A reference to a missing
     * token doesn't make it invalid. Its `resolvedValue` is just `undefined`.
     */
    readonly invalid?: true;
    /** The token's `$description`. */
    readonly description?: string;
    /**
     * `true`, or a message saying what to use instead.
     *
     * It can come from the token's group. It's `undefined` when the token isn't deprecated, even if it
     * writes `"$deprecated": false`.
     *
     * @see {@link https://www.designtokens.org/TR/2025.10/format/#deprecated | Format 5.2.4, Deprecated}
     */
    readonly deprecated?: true | string;
    /**
     * Where the token's deprecation comes from, when it doesn't write `$deprecated` itself.
     *
     * `path` names the group that writes the `$deprecated`, `""` for the top of the file. That's
     * the nearest group above with one, or a group it extends. `via` is `"group"`.
     *
     * @example
     * // The button group writes "$deprecated": "Use action"
     * light.getToken("button.padding")!.deprecatedFrom
     * // => { path: "button", via: "group" }
     */
    readonly deprecatedFrom?: InheritedFrom;
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
     * Set when a {@link Generator} makes the token.
     *
     * `path` names the group with the extension, `""` at the top of a file. `extension` is where the
     * generator's settings are in its `$extensions`, such as `["com.example", "steps"]`.
     */
    readonly generatedFrom?: {
        readonly path: string;
        readonly extension: readonly [string, ...string[]];
    };
    /**
     * Set when the token is here only through `$extends`, as a copy.
     *
     * `path` names the token it's a copy of, where it's written.
     *
     * @see {@link https://www.designtokens.org/TR/2025.10/format/#extending-groups | Format 6.4, Extending Groups}
     *
     * @example
     * // cta writes "$extends": "{button}"
     * light.getToken("cta.padding")!.extendedFrom
     * // => { path: "button.padding" }
     */
    readonly extendedFrom?: { readonly path: string };
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
 * Check `type`, and TypeScript knows the shape of `parsedValue` and `resolvedValue`.
 *
 * @example
 * // A color token's color space
 * const token = light.getToken("color.blue.500")!;
 * if (token.type === "color") token.resolvedValue?.colorSpace;
 * // => "srgb"
 */
export type Token = { [T in TokenType]: TokenBase<T> }[TokenType];

/**
 * Where a property a token or group doesn't write itself comes from.
 *
 * @example
 * // cta writes "$extends": "{button}", and button writes "$type": "dimension"
 * light.getGroup("cta")!.typeFrom
 * // => { path: "button", via: "extends" }
 */
export interface InheritedFrom {
    /** The group or token that writes it, such as `"button"`; `""` for the top of a file. */
    readonly path: string;
    /**
     * How it gets here: `"group"`, from a group it's inside; `"extends"`, through `$extends`;
     * `"reference"`, from the token its value refers to.
     */
    readonly via: "group" | "extends" | "reference";
}

const UNCOMPUTED = Symbol("not yet worked out");

type TokenFields = Omit<
    Token,
    "kind" | "getReferenceAt" | "aliasChain" | "winningDefinition" | "parts"
>;

class TokenObject {
    #aliasChain: readonly Token[] | undefined;
    #parts: Part | undefined | typeof UNCOMPUTED = UNCOMPUTED;

    constructor(fields: TokenFields) {
        const self = this as unknown as Record<string, unknown>;
        self.path = fields.path;
        self.type = fields.type;
        self.references = fields.references;
        self.definitions = fields.definitions;
        self.typeFrom = fields.typeFrom;
        self.parsedValue = fields.parsedValue;
        self.resolvedValue = fields.resolvedValue;
        self.invalid = fields.invalid;
        self.description = fields.description;
        self.deprecated = fields.deprecated;
        self.deprecatedFrom = fields.deprecatedFrom;
        self.extensions = fields.extensions;
        self.generatedFrom = fields.generatedFrom;
        self.extendedFrom = fields.extendedFrom;
    }

    getReferenceAt(property: JsonPath = []): Reference | undefined {
        return (this as unknown as Token).references.find((each) =>
            samePropertyPath(each.ownerProperty, property),
        );
    }

    get aliasChain(): readonly Token[] {
        this.#aliasChain ??= followAliasChain(this as unknown as Token);
        return this.#aliasChain;
    }

    get winningDefinition(): Definition {
        const { definitions } = this as unknown as Token;
        return definitions[definitions.length - 1] as Definition;
    }

    get parts(): Part | undefined {
        if (this.#parts === UNCOMPUTED) this.#parts = buildParts(this as unknown as Token);
        return this.#parts;
    }
}

Object.defineProperty(TokenObject.prototype, "kind", { value: "token" });

function followAliasChain(token: Token): Token[] {
    const chain: Token[] = [];
    for (let current: Token | undefined = token; current;) {
        if (chain.includes(current)) break;
        chain.push(current);
        current = current.getReferenceAt()?.pointsToWholeToken;
    }
    return chain;
}

export function createTokenObject(fields: TokenFields): Token {
    return new TokenObject(fields) as unknown as Token;
}
