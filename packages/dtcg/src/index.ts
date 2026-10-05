import type { StandardSchemaV1 } from "./standard-schema.js";
import type { ValueErrorDetail } from "./values/value-errors.js";

/** A color space defined by the DTCG Color module. */
export type ColorSpace =
    | "srgb"
    | "srgb-linear"
    | "hsl"
    | "hwb"
    | "lab"
    | "lch"
    | "oklab"
    | "oklch"
    | "display-p3"
    | "a98-rgb"
    | "prophoto-rgb"
    | "rec2020"
    | "xyz-d65"
    | "xyz-d50";

/** One channel of a color, or `"none"` when the channel does not apply.*/
export type ColorComponent = number | "none";

/**
 * A color, in the shape the DTCG Color module defines.
 *
 * @example
 * { colorSpace: "srgb", components: [0.8824, 0.1137, 0.2824], alpha: 1, hex: "#e11d48" }
 */
export interface ColorValue {
    /** The color space the components are in. */
    colorSpace: ColorSpace;
    /** The three channels, in the order the color space defines. */
    components: [ColorComponent, ColorComponent, ColorComponent];
    /**
     * Opacity, from 0 to 1.
     * @default 1
     */
    alpha: number;
    /** A six-digit hex fallback for tools that cannot use the color space. */
    hex?: string;
}

/** A length. */
export interface DimensionValue {
    value: number;
    unit: "px" | "rem";
}

/** A length of time. */
export interface DurationValue {
    value: number;
    unit: "ms" | "s";
}

/** The control points of a cubic Bézier easing curve: `[x1, y1, x2, y2]`, with both x values from 0 to 1. */
export type CubicBezierValue = [number, number, number, number];

/** Font names in order of preference. A single name is a list of one. */
export type FontFamilyValue = string[];

/** A font weight from 1 to 1000. Keywords such as `"bold"` are read as their numbers. */
export type FontWeightValue = number;

/** A plain number, such as a line-height multiplier or an opacity. */
export type NumberValue = number;

/** A line style: either a keyword, or a custom dash pattern. */
export type StrokeStyleValue =
    | {
          kind: "keyword";
          keyword:
              | "solid"
              | "dashed"
              | "dotted"
              | "double"
              | "groove"
              | "ridge"
              | "outset"
              | "inset";
      }
    | {
          kind: "dash";
          /** Alternating dash and gap lengths. */
          dashArray: DimensionValue[];
          /** How the end of each dash is drawn. */
          lineCap: "round" | "butt" | "square";
      };

/** A border, made of a color, a width and a line style. */
export interface BorderValue {
    color: ColorValue;
    width: DimensionValue;
    style: StrokeStyleValue;
}

/** One shadow. A shadow token contains a list of these. */
export interface ShadowLayer {
    color: ColorValue;
    offsetX: DimensionValue;
    offsetY: DimensionValue;
    blur: DimensionValue;
    spread: DimensionValue;
    /**
     * Whether the shadow is drawn inside the element.
     * @default false
     */
    inset: boolean;
}

/** A shadow: one or more layers. A single shadow is a list of one. */
export type ShadowValue = ShadowLayer[];

/** One color stop in a gradient. */
export interface GradientStop {
    color: ColorValue;
    /** Where the stop sits along the gradient, from 0 to 1. Values outside that range are clamped. */
    position: number;
}

/** A gradient, as its color stops. */
export type GradientValue = GradientStop[];

/** A transition: how long, how late, and with what easing. */
export interface TransitionValue {
    duration: DurationValue;
    delay: DurationValue;
    timingFunction: CubicBezierValue;
}

/** A complete typographic style. */
export interface TypographyValue {
    fontFamily: FontFamilyValue;
    fontSize: DimensionValue;
    fontWeight: FontWeightValue;
    letterSpacing: DimensionValue;
    /** A multiple of the font size. */
    lineHeight: NumberValue;
}

/** The value shape for each token type. */
export interface ValueByType {
    color: ColorValue;
    dimension: DimensionValue;
    duration: DurationValue;
    cubicBezier: CubicBezierValue;
    number: NumberValue;
    fontFamily: FontFamilyValue;
    fontWeight: FontWeightValue;
    strokeStyle: StrokeStyleValue;
    border: BorderValue;
    shadow: ShadowValue;
    gradient: GradientValue;
    transition: TransitionValue;
    typography: TypographyValue;
}

/** A token type defined by the DTCG Format module. */
export type TokenType = keyof ValueByType;

/**
 * A reference to another token, written `"{color.brand}"`. It stands for the whole of that
 * token's value.
 *
 * @example
 * // "$value": "{color.brand}" is read as
 * { alias: "color.brand" }
 */
export interface Alias {
    /** The path of the token referred to. */
    alias: string;
}

/**
 * A reference by JSON Pointer, written `{ "$ref": "#/…" }`. Unlike an {@link Alias}, it can point
 * inside another token's value, such as at one component of a color.
 *
 * @example
 * // "components": [{ "$ref": "#/color/blue/$value/components/0" }, 0.5, 0.5]
 * // reads the first component as
 * { pointer: "#/color/blue/$value/components/0" }
 */
export interface Pointer {
    /** The JSON Pointer, as written. */
    pointer: string;
}

/** `V`, with a {@link Pointer} allowed in place of the whole of it or any part of it. */
export type WithPointers<V> =
    | Pointer
    | (V extends object ? { [K in keyof V]: WithPointers<V[K]> } : V);

/**
 * A value whose references have not been followed yet: an {@link Alias} to a token holding one,
 * or the value with a {@link Pointer} in place of any part.
 */
export type Unresolved<V> = Alias | WithPointers<V>;

/** A stroke style whose references have not been followed yet, where the specification allows them. */
export type UnresolvedStrokeStyle =
    | Alias
    | Pointer
    | Extract<StrokeStyleValue, { kind: "keyword" }>
    | {
          kind: "dash";
          dashArray: Pointer | Unresolved<DimensionValue>[];
          lineCap: Pointer | "round" | "butt" | "square";
      };

/**
 * Where the specification allows references in each type's value. An {@link Alias} stands for a
 * whole token, so it may take the place of the whole value, or of a part of a composite that is a
 * token type in its own right. A {@link Pointer} may take the place of any part.
 */
export interface UnresolvedValueByType {
    color: Unresolved<ColorValue>;
    dimension: Unresolved<DimensionValue>;
    duration: Unresolved<DurationValue>;
    cubicBezier: Unresolved<CubicBezierValue>;
    number: Unresolved<NumberValue>;
    fontFamily: Unresolved<FontFamilyValue>;
    fontWeight: Unresolved<FontWeightValue>;
    strokeStyle: UnresolvedStrokeStyle;
    border:
        | Alias
        | Pointer
        | {
              color: Unresolved<ColorValue>;
              width: Unresolved<DimensionValue>;
              style: UnresolvedStrokeStyle;
          };
    shadow:
        | Alias
        | Pointer
        | (
              | Alias
              | Pointer
              | {
                    color: Unresolved<ColorValue>;
                    offsetX: Unresolved<DimensionValue>;
                    offsetY: Unresolved<DimensionValue>;
                    blur: Unresolved<DimensionValue>;
                    spread: Unresolved<DimensionValue>;
                    inset: Pointer | boolean;
                }
          )[];
    gradient:
        | Alias
        | Pointer
        | (
              | Alias
              | Pointer
              | { color: Unresolved<ColorValue>; position: Unresolved<NumberValue> }
          )[];
    transition:
        | Alias
        | Pointer
        | {
              duration: Unresolved<DurationValue>;
              delay: Unresolved<DurationValue>;
              timingFunction: Unresolved<CubicBezierValue>;
          };
    typography:
        | Alias
        | Pointer
        | {
              fontFamily: Unresolved<FontFamilyValue>;
              fontSize: Unresolved<DimensionValue>;
              fontWeight: Unresolved<FontWeightValue>;
              letterSpacing: Unresolved<DimensionValue>;
              lineHeight: Unresolved<NumberValue>;
          };
}

/**
 * A value of type `T` in its one agreed shape, with its references not yet followed: the type of
 * {@link TokenBase.value | Token.value}. {@link TokenBase.resolved | Token.resolved} is the same
 * value with them followed, and {@link TokenBase.authored | Token.authored} is how the file wrote it.
 */
export type UnresolvedValue<T extends TokenType> = UnresolvedValueByType[T];

export { isAlias, isPointer } from "./values/references.js";
export { referenceAt, references } from "./lookup/references.js";

/**
 * One part of a token's value: the whole value, a part of a composite, a shadow layer or gradient
 * stop, or a length in a dash pattern. Each is somewhere the spec lets a value or a reference to a
 * token stand. Checking `type` narrows `resolved` and the part's own parts.
 *
 * @example
 * const border = parts(token);
 * if (border?.type === "border") border.width.resolved   // { value: 1, unit: "px" }
 */
export type Part =
    | { [T in SimplePartType]: SimplePart<T> }[SimplePartType]
    | StrokeStylePart
    | BorderPart
    | TransitionPart
    | ShadowPart
    | GradientPart
    | TypographyPart;

/** The types whose values have no parts of their own. */
export type SimplePartType =
    | "color"
    | "dimension"
    | "duration"
    | "cubicBezier"
    | "number"
    | "fontFamily"
    | "fontWeight";

/** What every part has: where it is, what it resolved to, and the reference written there. */
export interface PartBase<V> {
    /** Where the part sits in {@link TokenBase.value | value}, as {@link references} places it. */
    at: JsonPath;
    resolved: V;
    /**
     * The reference written at this place, if any. A pointer inside the part, such as at one
     * component of a color, is not at it: what it reaches is in `resolved`.
     */
    ref?: Alias | Pointer;
}

/** A part with no parts of its own. */
export interface SimplePart<T extends SimplePartType> extends PartBase<ValueByType[T]> {
    type: T;
}

/**
 * A stroke style: a keyword, or a dash pattern with a part for each of its lengths. Checking
 * `"dashArray" in part` tells them apart.
 */
export type StrokeStylePart =
    | (PartBase<Extract<StrokeStyleValue, { kind: "keyword" }>> & { type: "strokeStyle" })
    | (PartBase<Extract<StrokeStyleValue, { kind: "dash" }>> & {
          type: "strokeStyle";
          dashArray: SimplePart<"dimension">[];
      });

export interface BorderPart extends PartBase<BorderValue> {
    type: "border";
    color: SimplePart<"color">;
    width: SimplePart<"dimension">;
    style: StrokeStylePart;
}

export interface TransitionPart extends PartBase<TransitionValue> {
    type: "transition";
    duration: SimplePart<"duration">;
    delay: SimplePart<"duration">;
    timingFunction: SimplePart<"cubicBezier">;
}

/** A shadow, as its layers. A single shadow has one. */
export interface ShadowPart extends PartBase<ShadowValue> {
    type: "shadow";
    layers: ShadowLayerPart[];
}

/** One layer of a shadow. Its `ref` is a reference to a shadow token standing for the layer. */
export interface ShadowLayerPart extends PartBase<ShadowLayer> {
    color: SimplePart<"color">;
    offsetX: SimplePart<"dimension">;
    offsetY: SimplePart<"dimension">;
    blur: SimplePart<"dimension">;
    spread: SimplePart<"dimension">;
}

/** A gradient, as its stops. */
export interface GradientPart extends PartBase<GradientValue> {
    type: "gradient";
    stops: GradientStopPart[];
}

/** One stop of a gradient. Its `ref` is a reference to a gradient token standing for the stop. */
export interface GradientStopPart extends PartBase<GradientStop> {
    color: SimplePart<"color">;
    position: SimplePart<"number">;
}

export interface TypographyPart extends PartBase<TypographyValue> {
    type: "typography";
    fontFamily: SimplePart<"fontFamily">;
    fontSize: SimplePart<"dimension">;
    fontWeight: SimplePart<"fontWeight">;
    letterSpacing: SimplePart<"dimension">;
    lineHeight: SimplePart<"number">;
}

export { parts } from "./lookup/parts.js";

/**
 * A choice of context for each modifier, which is how every function names a permutation.
 * Modifiers left out take their default, and matching ignores case.
 *
 * @example
 * { theme: "dark" }
 * { theme: "dark", brand: "ocean" }
 */
export type Input = Record<string, string>;

/** A path into a JSON document, one key or index per step. */
export type JsonPath = (string | number)[];

/**
 * A place in a file, for messages, editors and language servers: where it starts and how long it
 * is, and the line and column where it starts and ends. Lines and columns start at 1. Offsets,
 * lengths and columns count UTF-16 code units, as JavaScript strings do and as the Language Server
 * Protocol expects.
 */
export interface Span {
    file: string;
    offset: number;
    length: number;
    start: { line: number; column: number };
    end: { line: number; column: number };
}

/** What every token has, whatever its type. */
export interface TokenBase<T extends TokenType> {
    /**
     * Where the token sits in the tree, such as `"color.brand"`. A group's own `$root` token has
     * the path `"color.brand.$root"`, the way the spec writes a reference to it.
     */
    path: string;
    type: T;
    /**
     * The value, in one shape per type, with references kept as {@link Alias} and
     * {@link Pointer} nodes.
     * Absent when the token is {@link TokenBase.invalid | invalid}.
     */
    value?: UnresolvedValue<T>;
    /** The value with every reference followed. Absent when invalid or when a reference cannot be followed. */
    resolved?: ValueByType[T];
    /** Set when the value could not be read. The reasons are in {@link Document.diagnostics}, under this token's path. */
    invalid?: true;
    /** The token this one finally points at, when its whole value is a reference. */
    aliasOf?: string;
    description?: string;
    /** `true`, or a message explaining what to use instead. */
    deprecated?: boolean | string;
    /**
     * Vendor data from `$extensions`, passed through untouched. Plain JSON, so whole-number keys
     * inside it come first, in numeric order, as in any JavaScript object.
     */
    extensions?: Record<string, unknown>;
    /**
     * Where the token was read from: which of the permutation's {@link Permutation.sources | sources}
     * it belongs to, and exactly where it is written. That is usually in the source's file, and in
     * the resolver for a token written beside the source's `$ref`.
     */
    source: { index: number; at: Span };
    /**
     * The value exactly as the file wrote it, and whether the file declared `$type` on this token.
     * Absent when no file writes the token: one a {@link Generator} added.
     */
    authored?: { value: unknown; typeDeclared: boolean };
    /**
     * Set when a {@link Generator} makes the token from an extension on the group at `from`, whether
     * a file writes the token or it was added. `from` is `""` for an extension on the top level of a
     * file. An added token has no {@link TokenBase.authored | authored}, and its
     * {@link TokenBase.source | source} is the extension.
     */
    generated?: { from: string };
    /** Set when the token is here only because of `$extends`, or a `$ref` to another group, at `from`. */
    inherited?: { from: string };
}

/**
 * A design token. Checking `type` narrows `value` and `resolved` to that type's shape.
 *
 * @example
 * if (token.type === "color") token.resolved?.colorSpace
 */
export type Token = { [T in TokenType]: TokenBase<T> }[TokenType];

/** A group of tokens. */
export interface Group {
    path: string;
    /** The type its tokens take, when the group declares one. */
    type?: TokenType;
    description?: string;
    deprecated?: boolean | string;
    extensions?: Record<string, unknown>;
    /**
     * Every place the group is declared. Groups can be spread across files, so there may be
     * several, and a group only {@link Group.inherited | inherited} has none.
     */
    declaredIn: Span[];
    /** Set when the group is here only because of `$extends`, or a `$ref` to another group, at `from`. */
    inherited?: { from: string };
}

/**
 * One source of a permutation's tokens, as the resolver lists it: a file, part of one, or tokens
 * written in the resolver. Keys written beside a source's `$ref` are part of that source, so a
 * token written there belongs to it, and its {@link TokenBase.source | source.at} is in the
 * resolver. A set in the resolver can have several sources, so the same set can appear on several.
 */
export interface Source {
    /** The file its tokens are written in, or the resolver for tokens written there. */
    file: string;
    /** Set when the source is only part of the file, such as `"#/color"`. */
    pointer?: string;
    /**
     * How the resolver reached it: straight from a set, or through a modifier's context, possibly
     * by way of a set that context names. Absent when there is no resolver.
     */
    from?: { set: string } | { modifier: string; context: string; set?: string };
    /**
     * Vendor data for the source as a whole, passed through untouched: the `$extensions` of the
     * set that lists it, then those at the top of the source, with the source's keys winning.
     * `$extensions` written beside the source's `$ref` replace the ones at the top of the file.
     */
    extensions?: Record<string, unknown>;
}

/** The tokens that result from one input. */
export interface Permutation {
    input: Input;
    /**
     * A short name for display, such as `"default"`, `"dark"` or `"dark + ocean"`.
     * Functions take an {@link Input}, never a label.
     */
    label: string;
    /** Where the tokens come from, in the order they apply: a later source overrides an earlier one. */
    sources: Source[];
    /**
     * Every token, in the order the files write them, invalid ones included. The files read as
     * one: a group's tokens stay together where the group is first written, whichever file adds
     * them, and a token a later file replaces keeps its place. Tokens a group inherits, or a
     * {@link Generator} adds, come at the end of their group. To find one by path, use {@link token}.
     */
    tokens: Token[];
    /**
     * Every group, in the same order as {@link Permutation.tokens | tokens}. To find one by path,
     * use {@link group}.
     */
    groups: Group[];
    /**
     * Every reference between this permutation's tokens, one per reference as written, in the
     * order of {@link Permutation.tokens | tokens}. To ask what refers to a token, use
     * {@link referrers}.
     */
    edges: Edge[];
}

/** One reference from one token to another, in the permutation that holds it. */
export interface Edge {
    from: string;
    /** The token referred to. For a {@link Pointer} into part of a value, the token holding that part. */
    to: string;
    /** Where the reference is written. */
    at: Span;
}

/** A replacement of some text in a file. The offset and length count as in {@link Span}. */
export interface TextEdit {
    file: string;
    offset: number;
    length: number;
    text: string;
}

/** A change that would resolve a diagnostic. */
export interface Fix {
    /** What the fix does, for a menu or a prompt, such as "use `color.brand`, which has a similar name". */
    title: string;
    /**
     * Whether it can be applied without a person checking it. A safe fix never changes what the
     * design system means; an unsafe one is a likely guess a person should confirm.
     */
    safe: boolean;
    edits: TextEdit[];
}

/**
 * The facts each kind of diagnostic carries, so a tool can word diagnostics itself without
 * parsing {@link Diagnostic.message}.
 */
export interface DiagnosticDetailByKind {
    /** A file could not be fetched. */
    "file-not-found": {
        file: string;
        /** The file that names it, when it is not the entry. */
        referencedFrom?: string;
    };
    /** A file is not valid JSON (or, for a resolver, JSON with comments), or its top level is not an object. */
    "invalid-json": { reason: JsonErrorReason };
    /** A key is written twice in one object. The last one is used. */
    "duplicate-key": { key: string };
    /** The resolver breaks a rule of the resolver specification. */
    "resolver-invalid": ResolverProblem;
    /** An input does not fit the resolver's modifiers. */
    "input-invalid": {
        reason: "unknown-modifier" | "unknown-context" | "missing-modifier" | "not-a-string";
        /** Which input, as its index in {@link ReadOptions.inputs}. */
        input: number;
        modifier: string;
        context?: string;
        /**
         * For `unknown-modifier`, the modifiers the resolver declares; for `unknown-context` and
         * `missing-modifier`, the contexts the modifier allows.
         */
        valid?: string[];
    };
    /** A token or group name uses a character the specification forbids. */
    "invalid-name": { name: string; character: "." | "{" | "}" | "$" };
    /**
     * An object has a `$value` and also contains tokens or groups, or one file declares a token
     * where another declares a group.
     */
    "token-and-group": Record<string, never>;
    /** Something inside a group is neither a token nor a group: it is not an object. */
    "invalid-member": { name: string; found: "string" | "number" | "boolean" | "null" | "array" };
    /** A property the specification defines, such as `$description`, holds the wrong kind of JSON. */
    "invalid-property": {
        property: "$type" | "$description" | "$deprecated" | "$extensions" | "$extends" | "$ref";
        /** `"reference"`: a `"{group}"` reference, or a `{ "$ref": "#/…" }` pointer. */
        expected: "string" | "object" | "boolean-or-string" | "reference";
    };
    /** No type can be worked out for a token. */
    "missing-type": Record<string, never>;
    /** A `$type` is not one of the thirteen the specification defines (Format 8). */
    "unknown-type": { type: string };
    /** A value does not fit its type. */
    "invalid-value": {
        /** Where in the token or group, such as `["$value", "unit"]`. */
        at: JsonPath;
    } & ValueErrorDetail;
    /** A color written as a hex string, which the 2025.10 Color module no longer allows. */
    "hex-string-color": { value: string };
    /** An `$extensions` entry fails a registered check, such as a {@link Generator}'s. */
    "extension-invalid": {
        /** The `$extensions` key, such as `"com.example"`. */
        key: string;
        /** Where in the token or group, such as `["$extensions", "com.example", "steps"]`. */
        at: JsonPath;
        /** Why, as the check named it. A Standard Schema's issues have none. */
        reason?: string;
        /** The facts the check's message is worded from. */
        data?: unknown;
    };
    /** A reference points at nothing: no token, or for `$extends`, no group. */
    "missing-reference": {
        /** The reference as written, without braces: a path such as `color.brnad`, or a pointer. */
        ref: string;
        /** Every token or group that refers to it. */
        referencedBy: string[];
    };
    /** `$extends`, or a `$ref` standing for a group, points at a token (Format 6.4.6). */
    "not-a-group": { ref: string };
    /**
     * A `$ref` is not a JSON Pointer (RFC 6901): it does not start with `/` after the `#`, or a `~`
     * in it is not `~0` or `~1`. A fix writes it correctly when that reaches something, and always
     * for a reference into another file, whose target is not read.
     */
    "malformed-pointer": {
        ref: string;
        reason: "no-leading-slash" | "bad-escape";
        /** The reference written correctly. */
        corrected: string;
    };
    /** A reference to a token points at a group (Format 6.2: `{color.accent}` names a group, not a token). */
    "not-a-token": { ref: string };
    /**
     * A reference in a shadow or gradient list points at a token holding several layers or stops.
     * A reference in such a list stands for one (Format 9.1, 9.6, 9.7).
     */
    "reference-to-several": {
        ref: string;
        /** How many layers or stops the token holds. */
        count: number;
    };
    /** References that lead back to where they started. */
    "circular-reference": { chain: string[] };
    /** A reference points at a token of the wrong type. */
    "type-mismatch": { ref: string; expected: TokenType; found: TokenType };
    /** A name starts or ends with a space: legal, but almost always a typo. */
    "whitespace-in-name": { name: string };
    /**
     * An object has a key the specification does not define for it, so it is ignored: in a
     * resolver, or in a value, such as `paragraphSpacing` in a typography value. Your own data
     * belongs in `$extensions`.
     */
    "unknown-property":
        | { property: string; owner: "resolver" | "set" | "modifier" }
        | {
              property: string;
              /** The type of the value it is in, which for a part of a composite is the part's type. */
              owner: TokenType;
              /** Where in the token or group, such as `["$value", "paragraphSpacing"]`. */
              at: JsonPath;
          };
    /** A reference points at a token marked `$deprecated`. */
    "deprecated-reference": { ref: string; reason?: string };
    /** A resolver has more combinations than `permutationLimit`, so `"each-context"` was built instead. */
    "permutation-limit": {
        /** How many combinations the resolver's modifiers make. */
        count: number;
        limit: number;
        /** How many were built instead. */
        built: number;
    };
    /**
     * `"each-context"` sets every other modifier at its default, so with these modifiers having
     * none, some contexts could not be built on their own.
     */
    "no-default": { modifiers: string[] };
}

/**
 * Why a file could not be read as JSON. `"comment"` is a comment in a token file, which is JSON
 * and so has none; a resolver may contain comments.
 */
export type JsonErrorReason =
    | "comment"
    | "not-an-object"
    | "invalid-symbol"
    | "invalid-number-format"
    | "property-name-expected"
    | "value-expected"
    | "colon-expected"
    | "comma-expected"
    | "close-brace-expected"
    | "close-bracket-expected"
    | "end-of-file-expected"
    | "unexpected-end-of-comment"
    | "unexpected-end-of-string"
    | "unexpected-end-of-number"
    | "invalid-unicode"
    | "invalid-escape-character"
    | "invalid-character";

/** Which rule of the resolver specification a resolver breaks. */
export type ResolverRule =
    | "version"
    | "missing-property"
    | "wrong-type"
    | "unknown-set"
    | "unknown-modifier"
    | "invalid-pointer"
    | "circular-reference"
    | "resolver-as-source"
    | "duplicate-name"
    | "unknown-item-type"
    | "no-contexts"
    | "single-context"
    | "invalid-default"
    | "file-in-resolution-order";

/**
 * A rule a resolver breaks, what it concerns and where. Checking `rule` narrows the rest.
 *
 * @example
 * if (d.kind === "resolver-invalid" && d.detail.rule === "wrong-type") d.detail.expected
 */
export type ResolverProblem =
    | {
          rule: Exclude<ResolverRule, "wrong-type">;
          /** The property, set, modifier, pointer or file concerned. */
          name: string;
          /** Where in the resolver, such as `["sets", "base", "sources"]`. */
          at: JsonPath;
      }
    | {
          rule: "wrong-type";
          name: string;
          at: JsonPath;
          /** The JSON type the property must be. */
          expected: "string" | "object" | "array";
      };

/** What a diagnostic is about, as a stable name to switch on. Each has a page at {@link Diagnostic.docs}. */
export type DiagnosticKind = keyof DiagnosticDetailByKind;

/**
 * A problem or a note about the files. Reading carries on, so one read reports everything.
 * Checking `kind` narrows `detail` to that kind's facts.
 *
 * The message says what is wrong in plain words and names no tool's command or flag. It holds
 * no location: that is in `at`, for the tool to present as it likes.
 *
 * @example
 * if (d.kind === "missing-reference") d.detail.referencedBy
 */
export type Diagnostic = DiagnosticOf<DiagnosticDetailByKind>;

/**
 * A diagnostic with kinds of your own, in the same shape as {@link Diagnostic}, so a tool's own
 * checks can be reported in one list with the package's. Give it a map from each kind to the facts
 * it carries; checking `kind` narrows `detail`, as it does for {@link Diagnostic}. Choose kinds
 * that are not {@link DiagnosticKind | the package's}.
 *
 * @example
 * type Ours = DiagnosticOf<{ "selector-empty": { entry: number } }>;
 * const reported: (Diagnostic | Ours)[] = [...doc.diagnostics, ...checkConfig(doc)];
 */
export type DiagnosticOf<DetailByKind> = {
    [K in keyof DetailByKind]: {
        kind: K;
        severity: "error" | "warning" | "info" | "hint";
        message: string;
        /** Where the problem is, when it is in a file. */
        at?: Span;
        /** The token or group it concerns. */
        path?: string;
        /** Index into {@link Document.permutations}, when it concerns one permutation. */
        permutation?: number;
        /** Other places involved, such as every token that uses a missing one. */
        related?: { message: string; at: Span }[];
        /** Changes that would resolve it. */
        fixes?: Fix[];
        /** How an editor may show it: struck through for a deprecated reference. */
        tags?: ("deprecated" | "unnecessary")[];
        /** A page explaining this kind of diagnostic. */
        docs: string;
        detail: DetailByKind[K];
    };
}[keyof DetailByKind];

export { errors } from "./lookup/errors.js";

/**
 * The diagnostics about one token or group, for showing on its own page: those at its path, and
 * those about a reference it holds. A reference to a token that does not exist is reported once,
 * naming every token that uses it, so it appears here for each of them.
 *
 * @example
 * diagnosticsFor(doc, "color.brand") // includes "color.missing does not exist" if it refers to it
 */
export function diagnosticsFor(doc: Document, path: string): Diagnostic[] {
    throw new Error("not implemented yet");
}

/**
 * A design system as the DTCG specifications define it: every permutation, with every value in
 * one shape and every reference followed. Plain data: it survives `JSON.stringify`, and nothing
 * changes it after {@link read} returns it.
 */
export interface Document {
    /** The version of this package that produced it. */
    version: string;
    /**
     * Every file the read used, the entry first, in the order they were read. For watching and
     * reloading. Paths are as described at {@link ReadText}.
     */
    files: string[];
    /** The modifiers the resolver declares, with their contexts and defaults. */
    modifiers: Record<string, { contexts: string[]; default?: string }>;
    /**
     * Which permutations use each file: `"everyone"` for a file in a set, otherwise the contexts
     * whose permutations read it. For deciding which file an edit belongs in.
     *
     * @example
     * doc.usedBy["dark.json"] // [{ theme: "dark" }]
     */
    usedBy: Record<string, "everyone" | Input[]>;
    permutations: Permutation[];
    /** Every error, warning and note, in file order. {@link errors} picks out the errors. */
    diagnostics: Diagnostic[];
}

export type { ValueErrorCode, ValueErrorDetail, ValueErrorFacts } from "./values/value-errors.js";

/** Why a single value could not be read. */
export interface ValueError {
    kind: "invalid-value";
    /** Where in the value the problem is, such as `["color"]` inside a shadow. */
    path: JsonPath;
    message: string;
    /** Why, and the facts the message is worded from, so a tool can word it itself. */
    detail: ValueErrorDetail;
}

/**
 * A property a value's type does not define, such as `paragraphSpacing` in a typography value. It
 * is set aside, and the rest of the value is read without it.
 */
export interface IgnoredProperty {
    kind: "unknown-property";
    /** Where the property is, such as `["$value", "paragraphSpacing"]`. */
    path: JsonPath;
    message: string;
    /** The type of the value it is in, which for a part of a composite is the part's type. */
    detail: { type: TokenType; property: string };
}

/**
 * The outcome of reading one value. `ignored` lists the properties set aside, whether or not the
 * rest of the value could be read: empty when there are none.
 */
export type ParseResult<V> =
    | { ok: true; value: V; ignored: IgnoredProperty[] }
    | { ok: false; errors: ValueError[]; ignored: IgnoredProperty[] };

/** Reads one raw value into its shape, or explains why it cannot. */
export type Parse<V> = (raw: unknown, at: JsonPath, options?: ParseOptions) => ParseResult<V>;

/** How values are read, for {@link read} and the parsers alike. */
export interface ParseOptions {
    /**
     * Reads a color written as a hex string, such as `"#e11d48"` or `"#e11d4880"`, as the sRGB
     * color it names, with the string kept as `hex`. Not DTCG 2025.10, which writes every color as
     * an object. Off, or with three or four digits, a hex string is a `hex-string-color` error.
     * @default false
     */
    hexStringColors?: boolean;
    /**
     * Reads a value that has a property its type does not define, such as `paragraphSpacing` in a
     * typography value, by setting that property aside: each is listed in
     * {@link ParseResult | `ignored`}, which `read` reports as an `unknown-property` warning, and
     * the rest of the value is read. Not DTCG 2025.10, which makes such a composite token invalid
     * (Format 9.2). Off, the property is an `invalid-value` error, for colors, dimensions and
     * durations as for composites. A `$ref` with other properties beside it is an error either way.
     * @default false
     */
    ignoreUnknownProperties?: boolean;
}

export type { StandardSchemaV1, StandardTypedV1 } from "./standard-schema.js";

/**
 * A check for your own `$extensions` key, on the tokens and groups it applies to. The data is kept
 * either way; this only adds errors, each reported as `extension-invalid`.
 *
 * Give it a `schema` from any library that implements Standard Schema, such as Zod, Valibot or
 * ArkType: each issue is reported with the library's message. Or give it `validate` and
 * `messages`, to report problems with reasons and facts that a tool can word itself. With both, the
 * schema is checked first, and `validate` only sees an extension that passes it.
 *
 * @example
 * const fluid = defineExtensionValidator({
 *   key: "com.example",
 *   appliesTo: ["dimension"],
 *   schema: z.object({ fluid: z.boolean() }),
 * });
 */
export interface ExtensionValidator {
    /** The vendor namespace, such as `"com.example"`. */
    key: string;
    /** The token types it checks, and `"group"` for groups. */
    appliesTo: (TokenType | "group")[];
    /** A schema the extension must pass. It must validate synchronously. */
    schema?: StandardSchemaV1;
    /** The wording for each reason `validate` reports. */
    messages?: ExtensionMessages;
    /**
     * Why the extension is not valid, if it is not. An error's `path` starts at the extension. An
     * {@link ExtensionError} is worded from `messages`; a {@link ValueError}, from reading a value in
     * the extension with `parseValue`, is reported as `invalid-value`; an {@link IgnoredProperty}
     * from the same, as an `unknown-property` warning. `options` are how the read reads values, to
     * read the extension's the same way: give them to `extensionReader` or `parseValue`.
     */
    validate?(
        on: {
            path: string;
            /** The token's type, or `"group"`. */
            type: TokenType | "group";
        },
        extension: unknown,
        options: ParseOptions,
    ): (ExtensionError | ValueError | IgnoredProperty)[];
}

/** A token a generator makes, written as it would be in a file, with its name in the group. */
export interface GeneratedToken {
    /** Its name in the group, such as `"md"`. */
    name: string;
    /** @default the group's type */
    $type?: TokenType;
    $value: unknown;
    $description?: string;
    $extensions?: Record<string, unknown>;
}

/**
 * The messages for an extension's own reasons, one per reason, each worded from that reason's
 * facts. `dtcg` words a {@link Diagnostic} of kind `extension-invalid` from it, as it words its own
 * kinds from its own table, in the same style: plain words, a lowercase start, no full stop, no
 * location.
 *
 * @example
 * {
 *   "ratio-not-above-one": ({ ratio }: { ratio: number }) =>
 *     `a ratio of ${ratio} makes a flat or shrinking scale: it must be more than 1`,
 *   "no-multipliers": () => "`multipliers` must name at least one step",
 * }
 */
export type ExtensionMessages = Record<string, (data: any) => string>;

/**
 * Why an extension is not valid: where in it, a reason from its {@link ExtensionMessages}, and the
 * facts that reason is worded from. It carries no sentence: `dtcg` words it from the messages.
 *
 * @example
 * { path: ["ratio", "min"], reason: "ratio-not-above-one", data: { ratio: 1 } }
 */
export type ExtensionError<M extends ExtensionMessages = ExtensionMessages> = string extends keyof M
    ? {
          /** Where in the extension, such as `["ratio", "min"]`. */
          path: JsonPath;
          reason: string;
          data?: unknown;
      }
    : {
          [R in keyof M & string]: {
              /** Where in the extension, such as `["ratio", "min"]`. */
              path: JsonPath;
              reason: R;
          } & (Parameters<M[R]> extends [] ? { data?: undefined } : { data: Parameters<M[R]>[0] });
      }[keyof M & string];

/**
 * Makes tokens from an extension on a group, such as a scale recipe. The extension owns every token
 * it makes: each is marked {@link TokenBase.generated | generated}, whether a file writes it or not.
 * A token a file writes keeps its written value. A token no file writes is added, after the group's
 * files are merged and its `$extends` followed, and read like any written token, so references to
 * it resolve.
 */
export interface Generator {
    /**
     * Where the extension sits in a group's `$extensions`. A group without it is left alone.
     *
     * @example
     * ["sh.sugarcube", "scale"]
     */
    extension: [string, ...string[]];
    /**
     * A schema the extension must pass before `generate` sees it, from any library that implements
     * Standard Schema. Each issue is reported as `extension-invalid` with the library's message, and
     * `generate` is not called. It must validate synchronously.
     */
    schema?: StandardSchemaV1;
    /** The wording for each reason `generate` reports. */
    messages?: ExtensionMessages;
    /**
     * The tokens an extension makes, in the order to list them, or why the extension is not valid.
     * Tokens no file writes are listed at the end of the group. An error's `path` starts at the
     * extension. An {@link ExtensionError} is reported as `extension-invalid`, worded from
     * `messages`; a {@link ValueError}, from reading a value in the extension with `parseValue`, is
     * reported as `invalid-value`, as it would be in a token, and each of its `ignored` properties
     * as an `unknown-property` warning. With a `schema`, the extension is the
     * schema's output. A group whose extension is not valid gets no tokens added. The extension is
     * plain JSON, so whole-number keys inside it come first, in numeric order, whatever order the
     * file writes them in. `options` are how the read reads values, to read the extension's the
     * same way: give them to `extensionReader` or `parseValue`.
     */
    generate(
        group: {
            path: string;
            /** The type declared on the group, if any. */
            type?: TokenType;
        },
        extension: unknown,
        options: ParseOptions,
    ):
        | { ok: true; value: GeneratedToken[]; ignored?: IgnoredProperty[] }
        | { ok: false; errors: (ExtensionError | ValueError)[]; ignored?: IgnoredProperty[] };
}

export { defineGenerator } from "./read/generate.js";
export { defineExtensionValidator } from "./read/validate-extensions.js";

export interface ReadOptions extends ParseOptions {
    /**
     * The permutations to build. Modifiers left out take their default; an input that does not
     * fit the resolver is reported and not built.
     * @default the permutations `permutations` asks for
     */
    inputs?: Input[];
    /**
     * Which permutations to build when `inputs` is left out: `"all"`, every combination of
     * contexts, or `"each-context"`, the default and each context on its own, with every other
     * modifier at its default. When modifiers change different tokens (Resolver 2.1), every
     * combination can be put together from `"each-context"`.
     * @default "all"
     */
    permutations?: "all" | "each-context";
    /**
     * The most combinations `"all"` builds. Above it, `"each-context"` is built instead, and a
     * `permutation-limit` warning says so. Each combination is built in full, so a read grows with
     * them: at the default, a few hundred tokens still read inside a 16 ms frame.
     * @default 32
     */
    permutationLimit?: number;
    /** Checks for your own `$extensions` keys, run in each permutation once types are known. */
    extensionValidators?: ExtensionValidator[];
    /**
     * Generators that add tokens from extensions on groups, such as recipes. Run in order, in
     * each permutation, before values are read.
     */
    generators?: Generator[];
    /** Called as each stage of reading finishes, with how long it took. For progress and benchmarks. */
    onStage?: (stage: "load" | "generate" | "normalise" | "resolve", milliseconds: number) => void;
}

/**
 * Returns the text of a file, given its path.
 *
 * It is asked for each file by the entry's folder, as you gave it, joined with the file's path
 * from there: reading `"tokens/tokens.resolver.json"` asks for `"tokens/dark.json"`. A path
 * that is absolute or a URL is passed as written. Throwing, or rejecting, reports the file as not
 * found.
 *
 * Every file path in the results, in `Document.files`, `Span`, a project's files and every edit,
 * is relative to the entry's folder, with forward slashes, such as `"themes/dark.json"`. The
 * entry itself is its file name.
 */
export type ReadText = (path: string) => Promise<string>;

export { read, readFromMemory } from "./read/read.js";

/** One token across every permutation. */
export interface TokenView {
    path: string;
    /** The type in the default permutation, or in the first permutation that has the token. */
    type: TokenType;
    /** The token in each permutation that has it, keyed by {@link Permutation.label | label}. */
    permutations: Record<string, Token>;
    /** The token in the default permutation. */
    default?: Token;
}

export { byToken } from "./lookup/by-token.js";
export { pathBelow, withoutRoot } from "./path.js";
export { defaultPermutation, permutation } from "./lookup/permutation.js";
export { group, token, tokensIn } from "./lookup/token.js";

/** A token as it is in each permutation, in order. */
export function acrossPermutations(
    doc: Document,
    path: string,
): {
    input: Input;
    label: string;
    token: Token;
    /** Whether this permutation's value comes from a context's own file rather than the base. */
    overrides: boolean;
    /** How the value arrived: straight from a set, or through a modifier's context. */
    from: Source["from"];
}[] {
    throw new Error("not implemented yet");
}

/** A token or group whose path changed, such as after a rename. */
export interface Move {
    from: string;
    to: string;
}

/** A property a file can set on a token, named as the spec names it, without the `$`. */
export type TokenProperty = "value" | "type" | "description" | "deprecated" | "extensions";

/**
 * One difference between two reads of a design system. `changed` and `renamed` list the
 * properties that differ; a rename with nothing else changed lists none. `group-added` and
 * `group-removed` report groups, empty ones included; the tokens inside are reported on their own.
 */
export type Change =
    | { kind: "added"; path: string; in: Input[]; after: Token }
    | { kind: "removed"; path: string; in: Input[]; before: Token }
    | {
          kind: "changed";
          path: string;
          in: Input[];
          properties: TokenProperty[];
          before: Token;
          after: Token;
      }
    | {
          kind: "renamed";
          from: string;
          path: string;
          in: Input[];
          properties: TokenProperty[];
          before: Token;
          after: Token;
      }
    | { kind: "group-added"; path: string; in: Input[]; after: Group }
    | { kind: "group-removed"; path: string; in: Input[]; before: Group }
    | {
          kind: "group-changed";
          path: string;
          in: Input[];
          properties: Exclude<TokenProperty, "value">[];
          before: Group;
          after: Group;
      };

/**
 * What changed between two reads, and in which permutations: tokens and groups added, removed,
 * renamed, or with different properties. Values are compared with {@link sameValue}, and the other
 * properties exactly.
 *
 * Tokens a generator made are included, with `generated` set, so a tool can show the change to
 * the extension on its group and fold its tokens under it.
 *
 * Two reads alone cannot tell a rename from a removal and an addition. Pass the moves the edits
 * made, and those tokens are listed as `renamed`.
 *
 * @example
 * for (const change of diff(before, after, { moved })) row(change.kind, change.path);
 */
export function diff(before: Document, after: Document, options?: { moved?: Move[] }): Change[] {
    throw new Error("not implemented yet");
}

/**
 * Whether two values of a type are the same, allowing for the rounding that different spellings
 * of one value produce, such as color components written to different precision. Colors in different color spaces
 * are different values: to compare them, convert one into the other's space first.
 */
export function sameValue<T extends TokenType>(
    type: T,
    a: ValueByType[T],
    b: ValueByType[T],
): boolean;
/** Whether two tokens have the same type and the same resolved value. */
export function sameValue(a: Token, b: Token): boolean;
export function sameValue(...values: unknown[]): boolean {
    throw new Error("not implemented yet");
}

/** A token that is related to another, and the permutations in which it is. */
export interface Related {
    path: string;
    in: Input[];
}

export { type ReferrersOptions, referrers } from "./lookup/referrers.js";

/**
 * The tokens this one refers to.
 * @param input Only this permutation. Left out: every permutation.
 */
export function dependencies(
    doc: Document,
    path: string,
    input?: Input,
    options?: {
        /**
         * Include what it depends on through others, however indirectly. Safe with cycles.
         * @default false
         */
        transitive?: boolean;
    },
): Related[] {
    throw new Error("not implemented yet");
}

/**
 * Every token passed through on the way from this one to its final value.
 * @param input Which permutation. Defaults to the default permutation.
 */
export function aliasChain(doc: Document, path: string, input?: Input): string[] {
    throw new Error("not implemented yet");
}

/** What is at a position in a file. */
export type AtOffset =
    | { kind: "token"; path: string; expects?: TokenType }
    | { kind: "group"; path: string }
    | { kind: "reference"; from: string; to: string; permutation: Input; expects?: TokenType }
    | { kind: "nothing" };

/**
 * What is at a position in a file: a token, a group, or a reference, with the type a value there
 * must have. For editors and language servers.
 */
export function atOffset(doc: Document, file: string, offset: number): AtOffset {
    throw new Error("not implemented yet");
}

/** A JSON object, such as a DTCG file's top level: every value in it is plain JSON. */
export type JsonObject = { [key: string]: JsonValue };

/** Any value that can be written in a DTCG file. */
export type JsonValue =
    | string
    | number
    | boolean
    | null
    | JsonValue[]
    | { [key: string]: JsonValue };

/**
 * Turns a value from the model back into the JSON written in a DTCG file, with references as
 * `"{path}"` and pointers as `{ "$ref": "#/…" }`. Use this before writing a value from the model
 * into a file.
 *
 * @example
 * toDTCGValue("color", { alias: "color.brand" }) // "{color.brand}"
 * toDTCGValue("fontWeight", 400, { like: "regular" }) // "regular"
 */
export function toDTCGValue<T extends TokenType>(
    type: T,
    value: UnresolvedValue<T>,
    options?: {
        /**
         * An earlier value as the file wrote it, such as `token.authored.value`. Where the spec
         * allows more than one spelling, the result uses the same one: the same keyword, or a
         * number, for a font weight; one name or a list for a font family; one layer or a list for
         * a shadow.
         * @default the spec's own form
         */
        like?: unknown;
    },
): JsonValue {
    throw new Error("not implemented yet");
}

export interface ExportOptions {
    /**
     * Whether to write references as references, or as the values they point to.
     * @default "keep"
     */
    references?: "keep" | "resolve";
    /** Which tokens to write. A reference to a token left out is written as its value. */
    include?: (token: Token) => boolean;
}

/**
 * Writes one permutation as one self-contained DTCG file.
 *
 * Generated and inherited tokens are left out, and the group settings and `$extends` that make
 * them are written instead.
 * Invalid tokens are left out and listed in `skipped`.
 *
 * @param input Which permutation. Defaults to the default permutation.
 */
export function toDTCG(
    doc: Document,
    input?: Input,
    options?: ExportOptions,
): { tokens: JsonObject; skipped: string[] } {
    throw new Error("not implemented yet");
}

/**
 * Writes the whole design system as a resolver and its files: the default permutation in full,
 * then, for each other context, only what differs.
 */
export function toDTCGProject(
    doc: Document,
    options?: ExportOptions & {
        /**
         * Write a single resolver file with every source inline.
         * @default false
         */
        single?: boolean;
    },
): { files: Record<string, JsonObject>; skipped: string[] } {
    throw new Error("not implemented yet");
}
