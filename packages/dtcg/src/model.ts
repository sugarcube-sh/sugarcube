import type { StandardSchemaV1 } from "./standard-schema.js";
import type { ValueErrorDetail, ValueErrorFacts } from "./values/value-errors.js";

/**
 * A color space the Color module defines, such as `"srgb"`.
 *
 * @see {@link https://www.designtokens.org/TR/2025.10/color/#supported-color-spaces | Color 4.2, Supported color spaces}
 */
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

/**
 * One component of a color, or `"none"`.
 *
 * `"none"` means the component doesn't apply, or isn't given.
 *
 * @see {@link https://www.designtokens.org/TR/2025.10/color/#the-none-keyword | Color 4.1.1, The none keyword}
 */
export type ColorComponent = number | "none";

/**
 * A color, as the Color module writes it.
 *
 * @see {@link https://www.designtokens.org/TR/2025.10/color/#format | Color 4.1, Format}
 *
 * @example
 * // color.blue.500
 * light.getToken("color.blue.500")!.value
 * // => { colorSpace: "srgb", components: [0.2, 0.4, 0.8], alpha: 1 }
 */
export interface ColorValue {
    /** The color space the components are in, such as `"srgb"`. */
    readonly colorSpace: ColorSpace;
    /**
     * The three components, in the color space's order.
     *
     * For `"srgb"`, that's red, green and blue.
     */
    readonly components: readonly [ColorComponent, ColorComponent, ColorComponent];
    /**
     * How opaque the color is, from 0 to 1.
     *
     * @default 1
     */
    readonly alpha: number;
    /**
     * A six-digit hex fallback, such as `"#3366cc"`.
     *
     * It's for tools that can't use the color space.
     */
    readonly hex?: string;
}

/**
 * A length, such as `{ value: 16, unit: "px" }`.
 *
 * @see {@link https://www.designtokens.org/TR/2025.10/format/#dimension | Format 8.2, Dimension}
 */
export interface DimensionValue {
    readonly value: number;
    readonly unit: "px" | "rem";
}

/**
 * A length of time, such as `{ value: 200, unit: "ms" }`.
 *
 * @see {@link https://www.designtokens.org/TR/2025.10/format/#duration | Format 8.5, Duration}
 */
export interface DurationValue {
    readonly value: number;
    readonly unit: "ms" | "s";
}

/**
 * An easing curve's two control points, as `[x1, y1, x2, y2]`.
 *
 * Both x values are from 0 to 1.
 *
 * @see {@link https://www.designtokens.org/TR/2025.10/format/#cubic-bezier | Format 8.6, Cubic Bézier}
 */
export type CubicBezierValue = readonly [number, number, number, number];

/**
 * Font names, the first choice first.
 *
 * A file can write one name as a string. It's read as an array of one.
 *
 * @see {@link https://www.designtokens.org/TR/2025.10/format/#font-family | Format 8.3, Font family}
 */
export type FontFamilyValue = readonly string[];

/**
 * A font weight, from 1 to 1000.
 *
 * A keyword such as `"bold"` is read as its number, 700.
 *
 * @see {@link https://www.designtokens.org/TR/2025.10/format/#font-weight | Format 8.4, Font weight}
 */
export type FontWeightValue = number;

/**
 * A plain number, such as a line height or an opacity.
 *
 * @see {@link https://www.designtokens.org/TR/2025.10/format/#number | Format 8.7, Number}
 */
export type NumberValue = number;

/**
 * A line style.
 *
 * `kind: "keyword"` is a keyword, such as `"dashed"`.
 * `kind: "dash"` is your own pattern of dashes and gaps.
 *
 * @see {@link https://www.designtokens.org/TR/2025.10/format/#stroke-style | Format 9.3, Stroke style}
 */
export type StrokeStyleValue =
    | {
          readonly kind: "keyword";
          readonly keyword:
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
          readonly kind: "dash";
          /** The lengths of the dashes and gaps, one after the other. */
          readonly dashArray: readonly DimensionValue[];
          /** How the end of each dash is drawn. */
          readonly lineCap: "round" | "butt" | "square";
      };

/**
 * A border's color, width and line style.
 *
 * @see {@link https://www.designtokens.org/TR/2025.10/format/#border | Format 9.4, Border}
 */
export interface BorderValue {
    readonly color: ColorValue;
    readonly width: DimensionValue;
    readonly style: StrokeStyleValue;
}

/** One shadow in a {@link ShadowValue}. */
export interface ShadowLayer {
    readonly color: ColorValue;
    readonly offsetX: DimensionValue;
    readonly offsetY: DimensionValue;
    readonly blur: DimensionValue;
    readonly spread: DimensionValue;
    /**
     * Draws the shadow inside the element.
     *
     * @default false
     */
    readonly inset: boolean;
}

/**
 * One or more shadows, drawn together.
 *
 * A file can write one shadow as an object. It's read as an array of one.
 *
 * @see {@link https://www.designtokens.org/TR/2025.10/format/#shadow | Format 9.6, Shadow}
 */
export type ShadowValue = readonly ShadowLayer[];

/** One color stop in a gradient. */
export interface GradientStop {
    readonly color: ColorValue;
    /**
     * Where the stop is along the gradient, from 0 to 1.
     *
     * A value outside that range is read as 0 or 1.
     */
    readonly position: number;
}

/**
 * A gradient, as its color stops.
 *
 * @see {@link https://www.designtokens.org/TR/2025.10/format/#gradient | Format 9.7, Gradient}
 */
export type GradientValue = readonly GradientStop[];

/**
 * A transition's duration, delay and easing.
 *
 * @see {@link https://www.designtokens.org/TR/2025.10/format/#transition | Format 9.5, Transition}
 */
export interface TransitionValue {
    readonly duration: DurationValue;
    readonly delay: DurationValue;
    readonly timingFunction: CubicBezierValue;
}

/**
 * The font, size, weight, spacing and line height of text.
 *
 * @see {@link https://www.designtokens.org/TR/2025.10/format/#typography | Format 9.8, Typography}
 */
export interface TypographyValue {
    readonly fontFamily: FontFamilyValue;
    readonly fontSize: DimensionValue;
    readonly fontWeight: FontWeightValue;
    readonly letterSpacing: DimensionValue;
    /** A multiple of the font size, such as `1.5`. */
    readonly lineHeight: NumberValue;
}

/**
 * Each token type's value.
 *
 * `ValueByType["dimension"]` is {@link DimensionValue}.
 */
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

/**
 * A token type the spec defines, such as `"color"`.
 *
 * {@link tokenTypes} lists them all.
 *
 * @see {@link https://www.designtokens.org/TR/2025.10/format/#types | Format 8, Types}
 */
export type TokenType = keyof ValueByType;

/**
 * A curly brace reference, such as `"{color.primary}"`.
 *
 * It stands for the whole value of the token at `path`.
 *
 * @see {@link https://www.designtokens.org/TR/2025.10/format/#curly-brace-syntax-token-references | Format 7.1.1, Curly brace syntax}
 *
 * @example
 * // button.background's value
 * light.getToken("button.background")!.value
 * // => { syntax: "curly-brace", path: "color.primary" }
 */
export interface CurlyBraceReference {
    readonly syntax: "curly-brace";
    /** The path of the token it refers to, such as `"color.primary"`. */
    readonly path: string;
}

/**
 * A JSON Pointer reference, such as `{ "$ref": "#/color/blue/500/$value" }`.
 *
 * It can point at a whole token, or inside a value, such as at one color component.
 *
 * @see {@link https://www.designtokens.org/TR/2025.10/format/#json-pointer-syntax-required-support | Format 7.1.2, JSON Pointer syntax} and
 * {@link https://www.designtokens.org/TR/2025.10/format/#property-level-references | 7.3, Property-level references}
 *
 * @example
 * // The first component of color.blue.500
 * parseReference({ $ref: "#/color/blue/500/$value/components/0" })
 * // => { syntax: "json-pointer", pointer: "#/color/blue/500/$value/components/0" }
 */
export interface JsonPointerReference {
    readonly syntax: "json-pointer";
    /** The pointer as written, such as `"#/color/blue/500/$value"`. */
    readonly pointer: string;
}

/**
 * A reference in either syntax, as written.
 *
 * {@link isReference} tells one from a value.
 */
export type WrittenReference = CurlyBraceReference | JsonPointerReference;

/**
 * A reference written in a token or group.
 *
 * A token lists its references in {@link TokenBase.references | references}, and so does a
 * {@link Group.references | group}.
 *
 * @example
 * // button.background's reference
 * light.getToken("button.background")!.references[0]!.pointsToPath
 * // => "color.primary"
 */
export type Reference = ReferenceBase;

/** What every {@link Reference} has. */
export interface ReferenceBase {
    /** The reference as written, such as `{ syntax: "curly-brace", path: "color.primary" }`. */
    readonly asWritten: WrittenReference;
    /**
     * The path the reference names, such as `"color.primary"`.
     *
     * For a group's `$extends`, it's the group's path. For a JSON Pointer inside a value, it's the
     * path of the token holding that value.
     *
     * It's there even when nothing has that path. It's absent for a pointer that names no path,
     * such as `#/`.
     */
    readonly pointsToPath?: string;
    /**
     * The token or group that has the reference.
     *
     * For a token from `$extends`, it's the token in the group that extends.
     */
    readonly writtenIn: Token | Group;
    /**
     * The token the reference points to, in this permutation.
     *
     * It's `undefined` when the reference points to part of a value, to a group, or to nothing.
     */
    readonly pointsToToken?: Token;
    /**
     * Where in the token's value a JSON Pointer points.
     *
     * For example, `["components", 0]`. It's absent when the reference points to the whole value.
     *
     * @see {@link https://www.designtokens.org/TR/2025.10/format/#property-level-references | Format 7.3, Property-level references}
     */
    readonly pointsToProperty?: JsonPath;
    /**
     * Where in {@link TokenBase.value | value} the reference is.
     *
     * For example, `["components", 0]`. It's a path into the value as read, so a reference in a
     * single shadow's `color` is at `[0, "color"]`. It's absent for a reference that is the whole
     * value.
     */
    readonly writtenInProperty?: JsonPath;
    /**
     * Rewrites the reference after some moves, such as a rename.
     *
     * It keeps the syntax it was written in. Paths move as {@link tokenPath.applyMoves} moves them.
     *
     * @param moves - The {@link Move}s, made in order, such as
     * `[{ from: "color.primary", to: "color.accent" }]`.
     *
     * @example
     * // After renaming color.primary
     * reference.moved([{ from: "color.primary", to: "color.accent" }])
     * // => "{color.accent}"
     */
    moved(moves: readonly Move[]): JsonValue;
}

/**
 * A reference as {@link DesignTokens.getReferencesTo} returns it.
 *
 * It's written once, and can apply in several permutations.
 */
export type ReferenceInPermutations = Omit<
    ReferenceBase,
    "writtenIn" | "pointsToToken" | "moved"
> & {
    /** Where the reference is written in its file. */
    readonly span: Span;
    /** The keys to where it's written, as `getJsonPath` gives them. */
    readonly jsonPath: JsonPath;
    /**
     * The paths of the tokens or groups that have it.
     *
     * The first is the one written in the file. The rest get it through `$extends`.
     */
    readonly writtenInPaths: readonly string[];
    /** The permutations the reference applies in. */
    readonly permutations: Permutations;
    /** Rewrites the reference after some moves, as {@link ReferenceBase.moved} does. */
    moved(moves: readonly Move[]): JsonValue;
};

/** One answer from {@link askEveryPermutation}, and the permutations that gave it. */
export interface AnswerInPermutations<Answer> {
    readonly answer: Answer;
    /** The permutations that gave the answer. */
    readonly permutations: Permutations;
}

/** How far questions about references look. */
export interface ReferenceOptions {
    /**
     * Follows references through other tokens too, however far.
     *
     * Each reference is listed once, even if references loop.
     *
     * @default false
     * @see {@link https://www.designtokens.org/TR/2025.10/format/#chained-references | Format 7.2.2, Chained references}
     */
    chained?: boolean;
}

/** `V`, where the whole or any part can be a {@link JsonPointerReference}. */
export type WithPointers<V> =
    | JsonPointerReference
    | (V extends object ? { [K in keyof V]: WithPointers<V[K]> } : V);

/**
 * A value whose references aren't followed yet.
 *
 * The whole can be a {@link CurlyBraceReference}. The whole or any part can be a
 * {@link JsonPointerReference}.
 */
export type Unresolved<V> = CurlyBraceReference | WithPointers<V>;

/** A stroke style whose references aren't followed yet. */
export type UnresolvedStrokeStyle =
    | WrittenReference
    | Extract<StrokeStyleValue, { kind: "keyword" }>
    | {
          readonly kind: "dash";
          readonly dashArray: JsonPointerReference | readonly Unresolved<DimensionValue>[];
          readonly lineCap: JsonPointerReference | "round" | "butt" | "square";
      };

/**
 * Each token type's value, with references not followed yet.
 *
 * A curly brace reference can stand for the whole value. In a composite, it can also stand for a
 * part that's a token type itself, such as a border's `color`. A JSON Pointer can stand for any
 * part.
 *
 * @see {@link https://www.designtokens.org/TR/2025.10/format/#composite-types | Format 9, Composite types}
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
        | WrittenReference
        | {
              readonly color: Unresolved<ColorValue>;
              readonly width: Unresolved<DimensionValue>;
              readonly style: UnresolvedStrokeStyle;
          };
    shadow:
        | WrittenReference
        | readonly (
              | WrittenReference
              | {
                    readonly color: Unresolved<ColorValue>;
                    readonly offsetX: Unresolved<DimensionValue>;
                    readonly offsetY: Unresolved<DimensionValue>;
                    readonly blur: Unresolved<DimensionValue>;
                    readonly spread: Unresolved<DimensionValue>;
                    readonly inset: JsonPointerReference | boolean;
                }
          )[];
    gradient:
        | WrittenReference
        | readonly (
              | WrittenReference
              | {
                    readonly color: Unresolved<ColorValue>;
                    readonly position: Unresolved<NumberValue>;
                }
          )[];
    transition:
        | WrittenReference
        | {
              readonly duration: Unresolved<DurationValue>;
              readonly delay: Unresolved<DurationValue>;
              readonly timingFunction: Unresolved<CubicBezierValue>;
          };
    typography:
        | WrittenReference
        | {
              readonly fontFamily: Unresolved<FontFamilyValue>;
              readonly fontSize: Unresolved<DimensionValue>;
              readonly fontWeight: Unresolved<FontWeightValue>;
              readonly letterSpacing: Unresolved<DimensionValue>;
              readonly lineHeight: Unresolved<NumberValue>;
          };
}

/**
 * A value of type `T`, with its references not followed yet.
 *
 * It's the type of {@link TokenBase.value | Token.value}.
 * {@link TokenBase.resolved | Token.resolved} has the references followed.
 *
 * @example
 * // color.primary in dark
 * dark.getToken("color.primary")!.value
 * // => { syntax: "curly-brace", path: "color.blue.300" }
 */
export type UnresolvedValue<T extends TokenType> = UnresolvedValueByType[T];

/**
 * One part of a token's value.
 *
 * It can be the whole value, or a part of a composite. Shadow layers, gradient stops and the
 * lengths in a dash pattern are parts too. Check `type`, and TypeScript knows its `resolved` and
 * its own parts.
 *
 * @example
 * // button.background refers to color.primary
 * dark.getToken("button.background")!.parts?.ref?.pointsToPath
 * // => "color.primary"
 */
export type Part =
    | { [T in SimplePartType]: SimplePart<T> }[SimplePartType]
    | StrokeStylePart
    | BorderPart
    | TransitionPart
    | ShadowPart
    | GradientPart
    | TypographyPart;

/** The token types whose values have no parts of their own. */
export type SimplePartType =
    | "color"
    | "dimension"
    | "duration"
    | "cubicBezier"
    | "number"
    | "fontFamily"
    | "fontWeight";

/** What every part has. */
export interface PartBase<V> {
    /**
     * Where the part is in {@link TokenBase.value | value}, such as `["color"]`.
     *
     * It's absent for the whole value.
     */
    readonly property?: JsonPath;
    /** The part's value, with references followed. */
    readonly resolved: V;
    /**
     * The reference written as this part, if there is one.
     *
     * A JSON Pointer inside the part, such as to one color component, doesn't count. Its value is
     * in `resolved`.
     */
    readonly ref?: Reference;
}

/** A part with no parts of its own, such as a color. */
export interface SimplePart<T extends SimplePartType> extends PartBase<ValueByType[T]> {
    readonly type: T;
}

/**
 * A stroke style, as a part.
 *
 * A dash pattern has a part for each length in `dashArray`. A keyword doesn't, so
 * `"dashArray" in part` tells them apart.
 */
export type StrokeStylePart =
    | (PartBase<Extract<StrokeStyleValue, { readonly kind: "keyword" }>> & {
          readonly type: "strokeStyle";
      })
    | (PartBase<Extract<StrokeStyleValue, { readonly kind: "dash" }>> & {
          readonly type: "strokeStyle";
          readonly dashArray: readonly SimplePart<"dimension">[];
      });

/** A border, with a part for its color, width and style. */
export interface BorderPart extends PartBase<BorderValue> {
    readonly type: "border";
    readonly color: SimplePart<"color">;
    readonly width: SimplePart<"dimension">;
    readonly style: StrokeStylePart;
}

/** A transition, with a part for its duration, delay and easing. */
export interface TransitionPart extends PartBase<TransitionValue> {
    readonly type: "transition";
    readonly duration: SimplePart<"duration">;
    readonly delay: SimplePart<"duration">;
    readonly timingFunction: SimplePart<"cubicBezier">;
}

/**
 * A shadow, with a part for each layer.
 *
 * A single shadow has one layer.
 */
export interface ShadowPart extends PartBase<ShadowValue> {
    readonly type: "shadow";
    readonly layers: readonly ShadowLayerPart[];
}

/**
 * One layer of a shadow.
 *
 * Its `ref` is a reference to a shadow token used as this layer.
 */
export interface ShadowLayerPart extends PartBase<ShadowLayer> {
    readonly color: SimplePart<"color">;
    readonly offsetX: SimplePart<"dimension">;
    readonly offsetY: SimplePart<"dimension">;
    readonly blur: SimplePart<"dimension">;
    readonly spread: SimplePart<"dimension">;
}

/** A gradient, with a part for each stop. */
export interface GradientPart extends PartBase<GradientValue> {
    readonly type: "gradient";
    readonly stops: readonly GradientStopPart[];
}

/**
 * One stop of a gradient.
 *
 * Its `ref` is a reference to a gradient token used as this stop.
 */
export interface GradientStopPart extends PartBase<GradientStop> {
    readonly color: SimplePart<"color">;
    readonly position: SimplePart<"number">;
}

/** A text style, with a part for each of its five values. */
export interface TypographyPart extends PartBase<TypographyValue> {
    readonly type: "typography";
    readonly fontFamily: SimplePart<"fontFamily">;
    readonly fontSize: SimplePart<"dimension">;
    readonly fontWeight: SimplePart<"fontWeight">;
    readonly letterSpacing: SimplePart<"dimension">;
    readonly lineHeight: SimplePart<"number">;
}

/**
 * A selection of contexts, such as `{ mode: "dark" }`.
 *
 * Each key is a modifier, and each value one of its contexts. A modifier left out takes its
 * default. Names match whatever their case. Each input gives one {@link Permutation}.
 *
 * @see {@link https://www.designtokens.org/TR/2025.10/resolver/#inputs | Resolver 5, Inputs}
 */
export type Input = Readonly<Record<string, string>>;

/**
 * Keys into JSON, such as `["color", "primary", "$value"]`.
 *
 * Each step is a key, or an index into an array.
 */
export type JsonPath = readonly (string | number)[];

/**
 * A place in a file.
 *
 * It gives the place two ways. `offset` and `length` count characters from the start of the file.
 * `start` and `end` give the line and column. Lines and columns start at 1. Offsets, lengths and
 * columns count UTF-16 code units, as JavaScript strings do.
 */
export interface Span {
    readonly file: string;
    readonly offset: number;
    readonly length: number;
    readonly start: { readonly line: number; readonly column: number };
    readonly end: { readonly line: number; readonly column: number };
}

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
     * It can come from the token's group.
     *
     * @see {@link https://www.designtokens.org/TR/2025.10/format/#deprecated | Format 5.2.4, Deprecated}
     */
    readonly deprecated?: boolean | string;
    /**
     * The group whose `$deprecated` applies to this token.
     *
     * It's the nearest group above with one, written itself or through `$extends`. It's absent when
     * the token writes its own, when the top of its file writes one, or when there's none.
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
     * dark.getToken("color.primary")!.asWritten
     * // => { value: "{color.blue.300}", type: "color" }
     */
    readonly asWritten?: { readonly value: JsonValue } & Pick<Written, "type" | "deprecated">;
    /**
     * Set when a {@link Generator} makes the token.
     *
     * `from` is the group whose extension makes it. It's absent for an extension at the top of a
     * file. `extension` is where the generator's settings are in the group's `$extensions`, such as
     * `["com.example", "steps"]`.
     */
    readonly generated?: {
        readonly from?: string;
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
export interface Written {
    readonly type?: TokenType;
    readonly description?: string;
    readonly deprecated?: boolean | string;
    readonly extensions?: Readonly<Record<string, JsonValue>>;
}

/** A group of tokens. */
export interface Group {
    /**
     * Tells a group from a token.
     *
     * A JSON object without `$value` is a group.
     *
     * @see {@link https://www.designtokens.org/TR/2025.10/format/#group-structure | Format 6.1, Group Structure}
     */
    readonly kind: "group";
    /** Where the group is, such as `"color.blue"`. */
    readonly path: string;
    /**
     * The type its tokens take, such as `"color"`.
     *
     * It's the group's own `$type`, or else the type of the group it extends. Otherwise it's the
     * type of the group it's inside.
     *
     * @see {@link https://www.designtokens.org/TR/2025.10/format/#type-inheritance | Format 6.7.3, Type Inheritance}
     */
    readonly type?: TokenType;
    /** The group's `$description`, or else the one of the group it extends. */
    readonly description?: string;
    /**
     * `true`, or a message saying what to use instead.
     *
     * If the group doesn't write one, it comes from the group it extends, or else the group it's
     * inside.
     */
    readonly deprecated?: boolean | string;
    /**
     * The group whose `$deprecated` applies to this one.
     *
     * It's the group it extends, or else the nearest group above. It's absent when the group writes
     * its own, when the top of its file writes one, or when there's none.
     */
    readonly deprecatedByGroup?: string;
    /**
     * The group's `$extensions`, and any from the group it extends.
     *
     * Where both have a key, the group's own wins.
     */
    readonly extensions?: Readonly<Record<string, JsonValue>>;
    /**
     * The group this one extends, through `$extends`.
     *
     * It's absent if the reference doesn't reach a group. The reference is in
     * {@link Group.references | references}. The tokens it brings are marked
     * {@link TokenBase.inherited | inherited}.
     *
     * @see {@link https://www.designtokens.org/TR/2025.10/format/#extending-groups | Format 6.4, Extending Groups}
     */
    readonly extends?: Group;
    /**
     * The group's `$extends`, as a reference.
     *
     * It's empty when the group doesn't extend another.
     */
    readonly references: readonly Reference[];
    /**
     * Every place a file writes the group, in the order read.
     *
     * A group can be spread across files, so there can be several. A group that's only
     * {@link Group.inherited | inherited} has none.
     */
    readonly definitions: readonly Definition[];
    /**
     * Where each of the group's own `$extensions` keys is written.
     *
     * When several files write a key, it's the last one read. Its value for that key is used whole.
     * Keys from a group it extends are left out.
     */
    readonly extensionDefinitions: Readonly<Record<string, Definition>>;
    /**
     * Set when the group is here only through `$extends`.
     *
     * `from` is the group it comes from.
     */
    readonly inherited?: { readonly from: string };
    /**
     * The `$type`, `$description`, `$deprecated` and `$extensions` written on the group.
     *
     * It leaves out what comes from other groups. It's absent when the files write none of them.
     *
     * @example
     * // The color group writes its own $type
     * dark.getGroup("color")!.asWritten
     * // => { type: "color" }
     */
    readonly asWritten?: Written;
    /**
     * The group's tokens and groups, one level down, in the order written.
     *
     * What a later file adds comes after. Tokens from `$extends` or a {@link Generator} come last.
     * Each has a {@link TokenBase.kind | kind}.
     *
     * @example
     * // The color group
     * dark.getGroup("color")!.children.map((child) => child.path)
     * // => ["color.blue", "color.primary"]
     */
    readonly children: readonly (Token | Group)[];
    /**
     * The group's `$root` token, if it has one.
     *
     * @see {@link https://www.designtokens.org/TR/2025.10/format/#root-tokens-in-groups | Format 6.2, Root Tokens in Groups}
     */
    readonly rootToken?: Token;
    /**
     * The tokens directly in the group, in the order of {@link Group.children | children}.
     *
     * It includes the `$root` token.
     *
     * @example
     * // The color group
     * dark.getGroup("color")!.childTokens.map((token) => token.path)
     * // => ["color.primary"]
     */
    readonly childTokens: readonly Token[];
    /**
     * Every token in the group, however deep, in the order written.
     *
     * It includes the `$root` token. For only the tokens directly in it, use
     * {@link Group.childTokens | childTokens}.
     *
     * @example
     * // The color group
     * dark.getGroup("color")!.tokens.map((token) => token.path)
     * // => ["color.blue.500", "color.blue.300", "color.primary"]
     */
    readonly tokens: readonly Token[];
}

/**
 * What the top of a permutation's files writes.
 *
 * That's `$type`, `$description`, `$deprecated` and `$extensions`. The tokens and groups there are
 * the permutation's {@link Permutation.children | children}.
 */
export interface TopLevel {
    readonly type?: TokenType;
    readonly description?: string;
    readonly deprecated?: boolean | string;
    readonly extensions?: Readonly<Record<string, JsonValue>>;
    /** The top of each file that writes something there. */
    readonly definitions: readonly Definition[];
}

/**
 * A place where a token or group is written.
 *
 * It has the source that writes it, and the JSON written there. A definition read by several
 * permutations is the same object in each. To find where it is in the file, use `getSpan`.
 *
 * @example
 * // Where dark gets color.primary
 * dark.getToken("color.primary")!.winningDefinition.asWritten
 * // => { $type: "color", $value: "{color.blue.300}" }
 */
export interface Definition {
    /**
     * The source that writes it.
     *
     * That's the file, or part of one, and the set or context it's read through.
     */
    readonly source: Source;
    /**
     * The JSON written there, exactly as written.
     *
     * For a token, that's its whole object, such as `{ "$value": "{color.blue.500}" }`.
     */
    readonly asWritten: JsonValue;
}

/**
 * A definition as {@link DesignTokens.getDefinitions} returns it.
 *
 * It's written once, and can be read in several permutations.
 */
export interface DefinitionInPermutations {
    /** Where it's written in its file. */
    readonly span: Span;
    /** The keys to where it's written, as `getJsonPath` gives them. */
    readonly jsonPath: JsonPath;
    /** The JSON written there, exactly as written. */
    readonly asWritten: JsonValue;
    /** The sources that read it. */
    readonly sources: readonly Source[];
    /** The permutations that read it. */
    readonly permutations: Permutations;
    /**
     * The permutations where this definition gives the token its value.
     *
     * In each, it's the {@link TokenBase.winningDefinition | winningDefinition}. It's empty when a
     * later file always replaces it. It's also empty for a group, since a group's definitions are
     * combined, not replaced.
     *
     * @see {@link https://www.designtokens.org/TR/2025.10/resolver/#ordering | Resolver 6.2, Ordering}
     *
     * @example
     * // color.json's definition wins in light, dark.json's in dark
     * tokens.getDefinitions("color.primary").map((d) => d.winsIn.label)
     * // => ["mode: light", "mode: dark"]
     */
    readonly winsIn: Permutations;
}

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
    readonly sets: readonly SetOnRoute[];
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
     * light.sources[0]!.readBy
     * // => "every-context"
     *
     * @example
     * // Only the dark context lists dark.json
     * dark.sources[1]!.readBy
     * // => [{ name: "dark", … }]
     */
    readonly readBy: "every-context" | readonly ResolverContext[];
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
export interface SetOnRoute {
    /** The set's name, as in {@link DesignTokens.resolver}. */
    readonly name: string;
    readonly extensions?: Readonly<Record<string, JsonValue>>;
}

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
 * `{ file: "all.json", pointer: "#/dark" }` or `{ set: "base" }`. Tokens written in the resolver
 * have the resolver as their file.
 */
export type SourceRef =
    | { readonly file: string; readonly pointer?: string }
    | { readonly set: string };

/**
 * The tokens for one input.
 *
 * @see {@link https://www.designtokens.org/TR/2025.10/resolver/#permutation | Resolver 2.2, Permutation}
 */
export interface Permutation {
    /** The permutation's input, with a context for every modifier. */
    readonly input: Input;
    /**
     * The permutation's name, such as `"mode: dark"`.
     *
     * It's `""` when there are no modifiers.
     */
    readonly label: string;
    /**
     * The sources the tokens come from, in order.
     *
     * When two write the same token, the later one wins.
     */
    readonly sources: readonly Source[];
    /**
     * The context for each modifier, in the order `resolutionOrder` names them.
     *
     * Defaults are filled in. It's `""` when there are no modifiers.
     *
     * @example
     * // The contexts that aren't defaults
     * dark.contexts.filter((context) => !context.isDefault).map((context) => context.name)
     * // => ["dark"]
     */
    readonly contexts: readonly ResolverContext[];
    /**
     * `true` when every modifier is at its `default`.
     *
     * @example
     * // light is the default
     * light.isDefault
     * // => true
     */
    readonly isDefault: boolean;
    /** What the top of the files writes, as a {@link TopLevel}. */
    readonly topLevel: TopLevel;
    /**
     * The tokens and groups at the top of the files, in the order read.
     *
     * @example
     * // The top of the files
     * dark.children.map((child) => child.path)
     * // => ["color", "button"]
     */
    readonly children: readonly (Token | Group)[];
    /**
     * Every token, in the order written, including invalid ones.
     *
     * When several files write tokens, a group's tokens stay together. If `dark.json` adds
     * `color.accent`, it goes after the other `color` tokens, not at the end. And `dark.json`'s
     * `color.primary` stays where `color.json` put it. Tokens from `$extends` or a
     * {@link Generator} come last in their group.
     *
     * To find one by path, use {@link Permutation.getToken | getToken}.
     *
     * @example
     * // Every token in dark
     * dark.tokens.map((token) => token.path)
     * // => ["color.blue.500", "color.blue.300", "color.primary", "button.background"]
     */
    readonly tokens: readonly Token[];
    /**
     * Every group, in the same order as {@link Permutation.tokens | tokens}.
     *
     * To find one by path, use {@link Permutation.getGroup | getGroup}.
     */
    readonly groups: readonly Group[];
    /**
     * Gets the token at a path.
     *
     * It returns `undefined` if there's none, or a group is there.
     *
     * @param path - The token's path, such as `"color.primary"`.
     *
     * @example
     * // color.primary in dark
     * dark.getToken("color.primary")?.value
     * // => { syntax: "curly-brace", path: "color.blue.300" }
     */
    getToken(path: string): Token | undefined;
    /**
     * Gets the group at a path.
     *
     * @param path - The group's path, such as `"color.blue"`.
     *
     * @example
     * // The tokens in color.blue
     * dark.getGroup("color.blue")?.tokens.map((token) => token.path)
     * // => ["color.blue.500", "color.blue.300"]
     */
    getGroup(path: string): Group | undefined;
    /**
     * Gets the token or group at a path.
     *
     * Check `kind` to tell which.
     *
     * @param path - The path, such as `"color"`.
     *
     * @example
     * // color is a group
     * dark.getTokenOrGroup("color")?.kind
     * // => "group"
     */
    getTokenOrGroup(path: string): Token | Group | undefined;
    /**
     * Finds every reference to a token or group in this permutation.
     *
     * For a group, it also finds `$extends` to it, and references to anything inside it. For every
     * permutation at once, use {@link DesignTokens.getReferencesTo}.
     *
     * @param path - The token or group, such as `"color.blue.300"`.
     * @param options - `{ chained: true }` to follow references through other tokens too.
     *
     * @example
     * // What refers to color.blue.300 in dark, directly or not
     * dark
     *     .getReferencesTo("color.blue.300", { chained: true })
     *     .map((reference) => reference.writtenIn.path)
     * // => ["color.primary", "button.background"]
     */
    getReferencesTo(path: string, options?: ReferenceOptions): readonly Reference[];
    /**
     * Finds the tokens and groups a token or group refers to.
     *
     * A JSON Pointer to part of a token, such as one color component, counts as that token. For a
     * group, it's the group its `$extends` names. It's the reverse of
     * {@link Permutation.getDependents}.
     *
     * @param path - The token or group, such as `"button.background"`.
     * @param options - `{ chained: true }` to follow references through other tokens too.
     *
     * @example
     * // What button.background needs in dark, directly or not
     * dark.getDependencies("button.background", { chained: true }).map((token) => token.path)
     * // => ["color.primary", "color.blue.300"]
     */
    getDependencies(path: string, options?: ReferenceOptions): readonly (Token | Group)[];
    /**
     * Finds the tokens and groups that refer to a token or group.
     *
     * That includes a border whose `color` refers to it, and a group that extends it.
     *
     * @param path - The token or group, such as `"color.primary"`.
     * @param options - `{ chained: true }` to follow references through other tokens too.
     *
     * @example
     * // What uses color.primary in dark
     * dark.getDependents("color.primary").map((token) => token.path)
     * // => ["button.background"]
     */
    getDependents(path: string, options?: ReferenceOptions): readonly (Token | Group)[];
    /**
     * Finds the problems with a token or group in this permutation.
     *
     * That includes a missing reference it writes, a loop it's part of, and a problem in a token it
     * gets through `$extends`.
     *
     * @param path - The token or group, such as `"color.primary"`.
     *
     * @example
     * // Show each problem with color.primary
     * for (const problem of dark.getDiagnostics("color.primary")) console.log(problem.message);
     */
    getDiagnostics(path: string): readonly Diagnostic[];
}

/**
 * The facts behind each kind of diagnostic's message.
 *
 * Use them to word a diagnostic yourself, instead of parsing its `message`.
 */
export interface DiagnosticDetailByKind {
    /** A file isn't there, such as a `$ref` to `"gone.json"`. */
    "file-not-found": {
        readonly file: string;
        /** The file that names it, such as the resolver. Absent for the entry file. */
        readonly referencedFrom?: string;
    };
    /**
     * A file isn't valid JSON, or its top level isn't an object.
     *
     * A resolver may have comments, but a token file may not.
     */
    "invalid-json": { readonly reason: JsonErrorReason };
    /**
     * A key is written twice in one object, such as two `$value`s.
     *
     * A warning. The last one is used.
     */
    "duplicate-key": { readonly key: string };
    /**
     * The resolver breaks a rule of the resolver spec, such as a `version` other than `"2025.10"`.
     */
    "resolver-invalid": ResolverProblem;
    /**
     * An input in {@link ReadOptions.inputs} doesn't match the resolver.
     */
    "input-invalid": {
        /** Which input, by its index in {@link ReadOptions.inputs}. */
        readonly input: number;
    } & InputProblem;
    /**
     * A name has a character the spec doesn't allow, such as the `.` in `"a.b"`.
     *
     * @see {@link https://www.designtokens.org/TR/2025.10/format/#character-restrictions | Format 5.1.1, Character restrictions}
     */
    "invalid-name": { readonly name: string; readonly character: "." | "{" | "}" | "$" };
    /**
     * Something is both a token and a group.
     *
     * `reason: "child"` means a token has a `$value` and also holds `child`.
     * `reason: "declared"` means one file writes a token where another writes a group. `here` says
     * which this one is.
     * `reason: "ref"` means a `$ref` makes an object a token, and it also holds tokens or groups.
     */
    "token-and-group":
        | { readonly reason: "child"; readonly child: string }
        | { readonly reason: "declared"; readonly here: "token" | "group" }
        | { readonly reason: "ref"; readonly ref: string };
    /** Something in a group isn't an object, such as `"x": "red"`. */
    "invalid-member": {
        readonly name: string;
        readonly found: "string" | "number" | "boolean" | "null" | "array";
    };
    /** A spec property has the wrong kind of JSON, such as `"$description": 5`. */
    "invalid-property": {
        readonly property:
            | "$type"
            | "$description"
            | "$deprecated"
            | "$extensions"
            | "$extends"
            | "$ref";
        /**
         * The kind of JSON it needs.
         *
         * `"reference"` means a reference such as `"{base}"` or `{ "$ref": "#/base" }`.
         */
        readonly expected: "string" | "object" | "boolean-or-string" | "reference";
        /** For `"$extends": "base"`, the reference it should be, `"{base}"`. */
        readonly reference?: string;
    };
    /** A token has no type, and none can be worked out from its group or its reference. */
    "missing-type": Record<string, never>;
    /**
     * A `$type` the spec doesn't define, such as `"colour"`.
     *
     * @see {@link https://www.designtokens.org/TR/2025.10/format/#types | Format 8, Types}
     */
    "unknown-type": {
        readonly type: string;
        /** A type with a similar name, such as `"color"`, if exactly one is close. */
        readonly similar?: TokenType;
    };
    /** A value doesn't fit its type, such as a dimension in `em`. */
    "invalid-value": {
        /** Where in the token, such as `["$value", "unit"]`. */
        readonly jsonPath: JsonPath;
    } & ValueErrorDetail;
    /**
     * A color written as a hex string, such as `"#ff0000"`.
     *
     * The Color module needs a color object.
     */
    "hex-string-color": ValueErrorFacts["hex-string"];
    /** An `$extensions` entry fails a check, such as a {@link Generator}'s. */
    "extension-invalid": {
        /** The `$extensions` key, such as `"com.example"`. */
        readonly key: string;
        /** Where in the token or group, such as `["$extensions", "com.example", "steps"]`. */
        readonly jsonPath: JsonPath;
        /** Why, as the check names it. It's absent for a Standard Schema's problems. */
        readonly reason?: string;
        /** The facts the check's message is worded from. */
        readonly data?: unknown;
    };
    /**
     * A file writes a token that a {@link Generator} also makes, such as `space.1`.
     *
     * The generated token is used, and what the file writes is not.
     */
    "written-generated": {
        /** The token's path, such as `"space.1"`. */
        readonly path: string;
        /**
         * The group the token is made in, such as `"space"`.
         *
         * It's absent at the top of a file. It can be a group that extends the one with the
         * extension.
         */
        readonly from?: string;
        /** The generator's extension, such as `["com.example", "steps"]`. */
        readonly extension: readonly [string, ...string[]];
        /** What the file writes with that name. */
        readonly written: "token" | "group";
    };
    /** A reference names nothing, such as `{color.primry}`. */
    "missing-reference": {
        /** The reference as written, without braces, such as `"color.primry"`, or a pointer. */
        readonly ref: string;
        /** The path of each token or group that writes the reference. */
        readonly from: readonly string[];
        /**
         * A path close to `ref`, such as `"color.primary"`, if exactly one is close.
         *
         * For a JSON Pointer, it's a pointer. It's absent when the pointer's token exists, but a
         * step inside its value is wrong.
         */
        readonly similar?: string;
    };
    /**
     * `$extends` names a token, such as `"$extends": "{base}"` when `base` is a token.
     *
     * @see {@link https://www.designtokens.org/TR/2025.10/format/#error-conditions | Format 6.4.6, Error Conditions}
     */
    "not-a-group": { readonly ref: string };
    /**
     * A `$ref` isn't a valid JSON Pointer, such as `"#color/x/$value"`.
     *
     * It must start `#/`, and a `~` must be `~0` or `~1`.
     *
     * @see {@link https://www.rfc-editor.org/rfc/rfc6901 | RFC 6901, JSON Pointer}
     */
    "malformed-pointer": {
        readonly ref: string;
        readonly reason: "no-leading-slash" | "bad-escape";
        /**
         * The pointer written correctly, such as `"#/color/x/$value"`.
         *
         * It's there when the corrected pointer finds something, and always for a pointer into
         * another file.
         */
        readonly corrected?: string;
    };
    /**
     * A reference names a group, such as `{color.blue}`.
     *
     * @see {@link https://www.designtokens.org/TR/2025.10/format/#curly-brace-syntax-token-references | Format 7.1.1, Curly brace syntax}
     */
    "not-a-token": { readonly ref: string };
    /**
     * A reference in a shadow or gradient array names a token with several layers or stops.
     *
     * There, a reference stands for one layer or stop.
     *
     * @see {@link https://www.designtokens.org/TR/2025.10/format/#array-aliasing-in-composite-types | Format 9.1, Array aliasing in composite types}
     */
    "reference-to-several": {
        readonly ref: string;
        /** How many layers or stops the token has. */
        readonly count: number;
    };
    /**
     * References that loop back, such as `a` to `b` to `a`.
     *
     * @see {@link https://www.designtokens.org/TR/2025.10/format/#circular-references | Format 7.2.3, Circular References}
     */
    "circular-reference": {
        /** The paths around the loop, such as `["a", "b", "a"]`. */
        readonly chain: readonly string[];
        /** Set when the loop ends at a reference to the whole file. */
        readonly toTopLevel?: true;
    };
    /** A reference names a token of the wrong type, such as a number where a color is needed. */
    "type-mismatch": {
        readonly ref: string;
        readonly expected: TokenType;
        readonly found: TokenType;
    };
    /**
     * A name starts or ends with a space, such as `"a "`.
     *
     * It's allowed, but usually a typo.
     */
    "whitespace-in-name": { readonly name: string };
    /**
     * A property the spec doesn't define, such as `$foo` on a token.
     *
     * It's ignored. In a value, such as `paragraphSpacing` in a typography value, it's only
     * reported with `ignoreUnknownProperties` on. Otherwise it's an `invalid-value`.
     */
    "unknown-property":
        | {
              readonly property: string;
              readonly owner: "resolver" | "set" | "modifier" | "token" | "group";
              /**
               * A property with a similar name, such as `"sets"` for `"sest"`, if exactly one is
               * close.
               */
              readonly similar?: string;
          }
        | {
              readonly property: string;
              /** The type of the value it's in. For part of a composite, that's the part's type. */
              readonly type: TokenType;
              /** Where in the token, such as `["$value", "paragraphSpacing"]`. */
              readonly jsonPath: JsonPath;
          };
    /**
     * A spec property written another way, such as `value` or `$Value` for `$value`.
     *
     * It's read as that property, so nothing else fails because of it.
     */
    "misspelt-property": {
        readonly written: string;
        readonly property: "$value" | "$type" | "$description" | "$deprecated" | "$extensions";
        readonly owner: "token" | "group";
    };
    /** A reference names a token marked `$deprecated`. */
    "deprecated-reference": { readonly ref: string; readonly reason?: string };
    /**
     * A resolver has more combinations than `permutationLimit`.
     *
     * Then each context is built on its own instead, as with `"each-context"`.
     */
    "permutation-limit": {
        /** How many combinations the resolver's modifiers make. */
        readonly count: number;
        /** The `permutationLimit`, such as `32`. */
        readonly limit: number;
        /** How many were built instead. */
        readonly built: number;
    };
    /**
     * A set or modifier that `resolutionOrder` never uses.
     *
     * It's a hint, tagged `unnecessary` so an editor can fade it.
     */
    "not-in-resolution-order": {
        readonly item: "set" | "modifier";
        readonly name: string;
    };
}

/**
 * Why a file isn't valid JSON, such as `"comma-expected"`.
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

/** A rule of the resolver spec, such as `"version"`. */
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
 * The rule a resolver breaks, and where.
 *
 * Check `rule`, and TypeScript knows the rest.
 *
 * @example
 * // A version that isn't "2025.10"
 * diagnostic.detail
 * // => { rule: "version", name: "version", jsonPath: ["version"] }
 */
export type ResolverProblem =
    | {
          readonly rule: Exclude<ResolverRule, "wrong-type">;
          /** The property, set, modifier, pointer or file it's about. */
          readonly name: string;
          /** Where in the resolver, such as `["sets", "base", "sources"]`. */
          readonly jsonPath: JsonPath;
      }
    | {
          readonly rule: "wrong-type";
          readonly name: string;
          readonly jsonPath: JsonPath;
          /** The JSON type the property must be. */
          readonly expected: "string" | "object" | "array";
      };

/**
 * The name of a kind of diagnostic, such as `"missing-reference"`.
 *
 * Check this in your code, not the message. Each kind has a page at {@link Diagnostic.docsUrl}.
 */
export type DiagnosticKind = keyof DiagnosticDetailByKind;

/**
 * A problem with the files, or a note about them.
 *
 * Reading carries on past a problem, so one read reports them all. Check `kind`, and TypeScript
 * knows its `detail`. To fix one, see `@sugarcube-sh/dtcg-edit`.
 *
 * @example
 * // A typo in a reference
 * if (diagnostic.kind === "missing-reference") diagnostic.detail.similar;
 * // => "color.primary"
 */
export type Diagnostic = DiagnosticOf<DiagnosticDetailByKind> & {
    readonly permutations: Permutations;
};

/**
 * A diagnostic with your own kinds.
 *
 * It has the same shape as {@link Diagnostic}, so your checks can be listed with dtcg's. Pass a map
 * from each kind to its facts. Pick kinds dtcg doesn't use.
 *
 * @example
 * // A config check, listed with the read's diagnostics
 * type ConfigDiagnostic = DiagnosticOf<{ "selector-empty": { entry: number } }>;
 * const all: (Diagnostic | ConfigDiagnostic)[] = [...tokens.diagnostics, ...checkConfig(tokens)];
 */
export type DiagnosticOf<DetailByKind> = {
    [K in keyof DetailByKind]: {
        readonly kind: K;
        readonly severity: "error" | "warning" | "info" | "hint";
        readonly message: string;
        /** Where the problem is, when it is in a file. */
        readonly span?: Span;
        /** The token or group it concerns. */
        readonly path?: string;
        /**
         * The permutations that have the problem.
         *
         * dtcg's own diagnostics always have it. A problem in the resolver applies `"everywhere"`.
         * Your own kinds can leave it out.
         */
        readonly permutations?: Permutations;
        /**
         * Other places involved, each with its own message, such as where a duplicate key is also
         * written.
         */
        readonly relatedInformation?: readonly {
            readonly message: string;
            readonly span: Span;
            readonly path?: string;
        }[];
        /**
         * How an editor can show it.
         *
         * `"unnecessary"` fades it, and `"deprecated"` strikes it through.
         */
        readonly tags?: readonly ("deprecated" | "unnecessary")[];
        /** A page about this kind of diagnostic. */
        readonly docsUrl: string;
        readonly detail: DetailByKind[K];
    };
}[keyof DetailByKind];

/**
 * Design tokens, as {@link read} returns them, with every permutation.
 *
 * Everything in them is read-only. A token or group that's the same in two permutations is one
 * object in both, so `===` tells whether it differs.
 *
 * @example
 * // color.blue.500 is the same in light and dark
 * light.getToken("color.blue.500") === dark.getToken("color.blue.500")
 * // => true
 */
export interface DesignTokens {
    /**
     * Every file the read used, the entry file first.
     *
     * Paths are relative to the entry file's folder, such as `"dark.json"`.
     */
    readonly files: readonly string[];
    /** The file the read started from, such as `"tokens.resolver.json"`. */
    readonly entryFile: string;
    /** The resolver, if the read started from one. */
    readonly resolver?: Resolver;
    /** Every source the read used, each once. */
    readonly sources: readonly Source[];
    /**
     * Every permutation the read built, in the resolver's order.
     *
     * The default isn't always first. To get it, use `getPermutation()`.
     */
    readonly permutations: Permutations;
    /**
     * How the values were read.
     *
     * To read a value in `$extensions` the same way, pass these to `parseValue` or
     * `createExtensionReader`.
     */
    readonly parseOptions: Required<ParseOptions>;
    /**
     * Every problem the read found.
     *
     * For one token or group, use {@link DesignTokens.getDiagnostics | getDiagnostics}. For a place
     * in a file, use `getDiagnosticsAt`.
     */
    readonly diagnostics: readonly Diagnostic[];
    /**
     * Finds every reference to a token or group, in any file.
     *
     * Each is listed once, with the tokens that write it and the permutations it applies in. To
     * follow chains of references, use {@link Permutation.getReferencesTo}.
     *
     * @param path - The token or group, such as `"color.primary"`.
     *
     * @example
     * // Nothing refers to button.background
     * tokens.getReferencesTo("button.background").length
     * // => 0
     */
    getReferencesTo(path: string): readonly ReferenceInPermutations[];
    /**
     * Finds every place a token or group is written, in any permutation.
     *
     * @param path - The token or group, such as `"color.primary"`.
     *
     * @example
     * // color.json and dark.json both write color.primary
     * tokens.getDefinitions("color.primary").map((definition) => definition.span.file)
     * // => ["color.json", "dark.json"]
     */
    getDefinitions(path: string): readonly DefinitionInPermutations[];
    /**
     * Gets the permutation for an input.
     *
     * Without an input, it returns the default permutation.
     *
     * @param input - The input, such as `{ mode: "dark" }`.
     * @throws {@link PermutationError} If no permutation the read built fits the input.
     *
     * @example
     * // The dark permutation
     * tokens.getPermutation({ mode: "dark" }).label
     * // => "mode: dark"
     */
    getPermutation(input?: Input): Permutation;
    /**
     * Gets the token at a path, when the read has one permutation.
     *
     * It's {@link Permutation.getToken} for that permutation.
     *
     * @param path - The token's path, such as `"color.primary"`.
     * @throws {@link SeveralPermutationsError} If the read has several permutations.
     */
    getToken(path: string): Token | undefined;
    /**
     * Gets the group at a path, when the read has one permutation.
     *
     * It's {@link Permutation.getGroup} for that permutation.
     *
     * @param path - The group's path, such as `"color.blue"`.
     * @throws {@link SeveralPermutationsError} If the read has several permutations.
     */
    getGroup(path: string): Group | undefined;
    /**
     * Gets the token or group at a path, when the read has one permutation.
     *
     * It's {@link Permutation.getTokenOrGroup} for that permutation.
     *
     * @param path - The token or group, such as `"color.primary"`.
     * @throws {@link SeveralPermutationsError} If the read has several permutations.
     */
    getTokenOrGroup(path: string): Token | Group | undefined;
    /**
     * Finds what refers to a token or group, when the read has one permutation.
     *
     * It's {@link Permutation.getDependents} for that permutation. To check every permutation, use
     * {@link DesignTokens.getReferencesTo | getReferencesTo}.
     *
     * @param path - The token or group, such as `"color.primary"`.
     * @param options - `{ chained: true }` to follow references through other tokens too.
     * @throws {@link SeveralPermutationsError} If the read has several permutations.
     */
    getDependents(path: string, options?: ReferenceOptions): readonly (Token | Group)[];
    /**
     * Finds what a token or group refers to, when the read has one permutation.
     *
     * It's {@link Permutation.getDependencies} for that permutation.
     *
     * @param path - The token or group, such as `"color.primary"`.
     * @param options - `{ chained: true }` to follow references through other tokens too.
     * @throws {@link SeveralPermutationsError} If the read has several permutations.
     */
    getDependencies(path: string, options?: ReferenceOptions): readonly (Token | Group)[];
    /**
     * Every token, when the read has one permutation.
     *
     * It's {@link Permutation.tokens} for that permutation.
     *
     * @throws {@link SeveralPermutationsError} If the read has several permutations.
     */
    readonly tokens: readonly Token[];
    /**
     * Every group, when the read has one permutation.
     *
     * It's {@link Permutation.groups} for that permutation.
     *
     * @throws {@link SeveralPermutationsError} If the read has several permutations.
     */
    readonly groups: readonly Group[];
    /**
     * The tokens and groups at the top of the files, when the read has one permutation.
     *
     * It's {@link Permutation.children} for that permutation.
     *
     * @throws {@link SeveralPermutationsError} If the read has several permutations.
     */
    readonly children: readonly (Token | Group)[];
    /**
     * What the top of the files writes, when the read has one permutation.
     *
     * It's {@link Permutation.topLevel} for that permutation.
     *
     * @throws {@link SeveralPermutationsError} If the read has several permutations.
     */
    readonly topLevel: TopLevel;
    /**
     * Gets every token's path, in any permutation, each once.
     *
     * @example
     * // Every token path
     * tokens.getTokenPaths()
     * // => ["color.blue.500", "color.blue.300", "color.primary", "button.background"]
     */
    getTokenPaths(): readonly string[];
    /** Gets every group's path, in any permutation, each once. */
    getGroupPaths(): readonly string[];
    /**
     * Checks whether a token or group is at a path, in any permutation.
     *
     * @param path - The path, such as `"color.blue"`.
     *
     * @example
     * // color.blue is a group
     * tokens.has("color.blue")
     * // => true
     */
    has(path: string): boolean;
    /**
     * Gets a file's text, exactly as read.
     *
     * It returns `undefined` for a file the read didn't use.
     *
     * @param file - The file, such as `"dark.json"`.
     */
    getText(file: string): string | undefined;
    /**
     * Reads the tokens again, after some files changed.
     *
     * It uses the same entry file and options. These tokens don't change.
     *
     * @param changed - Each changed file's new text, such as `{ "dark.json": text }`. Pass `null`
     * for a deleted file.
     *
     * @example
     * // dark.json now points color.primary at color.blue.500
     * const next = tokens.reread({ "dark.json": text });
     * next.getPermutation({ mode: "dark" }).getToken("color.primary")?.value
     * // => { syntax: "curly-brace", path: "color.blue.500" }
     */
    reread(changed: Readonly<Record<string, string | null>>): DesignTokens;
    /**
     * Reads the tokens again, from every file's text as it is now.
     *
     * A file you leave out is read as deleted. If no file changed, it returns these same tokens. If
     * you know which files changed, use {@link DesignTokens.reread}.
     *
     * @param files - Every file's text, such as `tokens.toMemory().files`.
     *
     * @example
     * // Nothing changed
     * tokens.rereadAll(tokens.toMemory().files) === tokens
     * // => true
     */
    rereadAll(files: Readonly<Record<string, string>>): DesignTokens;
    /**
     * Gets the entry file and every file's text, to read them somewhere else.
     *
     * Pass the result to {@link readFromMemory}, with the same options, to get the same tokens.
     *
     * @example
     * // Every file the read used
     * Object.keys(tokens.toMemory().files)
     * // => ["tokens.resolver.json", "color.json", "dark.json"]
     */
    toMemory(): TokensInMemory & { readonly entryFile: string };
    /**
     * Finds what changed since an earlier read.
     *
     * A token is compared by what it says, not what it resolves to. So changing `color.blue.500` is
     * one change, not one for every token that refers to it. To list a rename as `renamed`, pass
     * the moves.
     *
     * @param before - An earlier read, such as the tokens before
     * {@link DesignTokens.reread | reread}.
     * @param options - `moved`, the {@link Move}s the edits made, in order.
     *
     * @example
     * // color.blue.500 has a new value in color.json
     * tokens.reread({ "color.json": text }).getChangesSince(tokens).map((change) => change.path)
     * // => ["color.blue.500"]
     */
    getChangesSince(before: DesignTokens, options?: { moved?: readonly Move[] }): readonly Change[];
    /**
     * Finds the problems with a token or group, in every permutation.
     *
     * Each comes with the permutations it's in. The kinds are as for
     * {@link Permutation.getDiagnostics}.
     *
     * @param path - The token or group, such as `"color.primary"`.
     */
    getDiagnostics(path: string): readonly Diagnostic[];
}

/**
 * Which permutations a group holds, described by their contexts: parts joined by "or", each part
 * naming, for each modifier that narrows it, the contexts it keeps. A modifier a part leaves out may
 * be any of its contexts, unlike in an {@link Input}, where it is at its default (Resolver 6.1).
 * Every part matches only permutations in the group, among every combination the resolver's
 * modifiers make, built or not: so a group that is every permutation of a read that built only
 * some isn't `[{}]`, and a group of one permutation names every modifier. Modifiers come in the
 * order `resolutionOrder` names them, contexts as they are written.
 *
 * @example
 * [{ mode: ["dark", "dim"], contrast: ["high"] }]       // dark or dim, in high contrast
 * [{ brand: ["cbus", "hesta-super"] }, { inverted: ["on"] }]  // those brands, or inverted
 * [{}]                                                  // every combination
 * []                                                    // none
 */
export type Scope = readonly Readonly<Record<string, readonly string[]>>[];

/**
 * Some of the design tokens' permutations, in their order: the ones an answer, a problem or the
 * design tokens themselves cover. A read-only list, so `find`, `map`, `includes` and `length` work
 * as on any array, with the inputs, the scope and a label beside it.
 *
 * @example
 * for (const { writtenInPaths, permutations } of tokens.getReferencesTo("color.red")) {
 *   row(writtenInPaths, permutations.label);   // "mode: dark, sepia", or "everywhere"
 * }
 */
export interface Permutations extends ReadonlyArray<Permutation> {
    /** Each permutation's input, in the same order. */
    readonly inputs: readonly Input[];
    /**
     * Which permutations it holds, by their contexts, for a tool that words them its own way.
     *
     * @example
     * const rest = tokens.permutations.select((each) => !group.includes(each));
     * rest.scope; // what a tool could show as "except …"
     */
    readonly scope: Scope;
    /**
     * Every permutation the read built that it doesn't hold, in their order: for "everywhere
     * but …", and for whether it is every permutation the read built (none other). Not the same as
     * a {@link Permutations.label | label} of `"everywhere"`, which is every combination the
     * resolver's modifiers make: a read limited by `inputs`, or built `"each-context"`, can hold
     * every permutation it built without holding every combination.
     *
     * @example
     * // say where a problem is only when it isn't everywhere the read looked
     * const { permutations } = problem;
     * const where = permutations.others.length === 0 ? "" : ` in ${permutations.label}`;
     */
    readonly others: Permutations;
    /**
     * Its {@link Permutations.scope | scope} written out: each modifier and the contexts it keeps,
     * such as `"mode: dark, dim, contrast: high"`, parts joined with `"; "`. A modifier left out may
     * be any of its contexts, so `"mode: dark"` is every dark permutation; one permutation alone
     * names every modifier, as its own {@link Permutation.label | label} does. Every combination is
     * `"everywhere"`, none `"nowhere"`.
     */
    readonly label: string;
    /**
     * The permutations that pass `test`, in the same order, as permutations of their own: labelled
     * against every permutation the read built, as an answer's are. Where `filter` gives a plain
     * list, this keeps the label.
     *
     * @example
     * const elsewhere = tokens.permutations.select((each) => each !== edited);
     * elsewhere.label; // "mode: light"
     */
    select(test: (permutation: Permutation) => boolean): Permutations;
    /**
     * The permutation in this list that an input names, found as {@link DesignTokens.getPermutation}
     * finds it: modifiers left out take their default (Resolver 4.1.5.3), and names match
     * whatever their case (Resolver 5.1); `undefined` when the resolver has no such
     * context or modifier, when the read built no such permutation, or when this list doesn't hold
     * it. What a tool asks to find a permutation again from an input it kept, such as one chosen
     * before the files changed. For why there is none, ask {@link DesignTokens.getPermutation}, whose
     * {@link PermutationError} says.
     *
     * @example
     * tokens.permutations.findByInput({ mode: "dark" })?.label;                          // "mode: dark"
     * tokens.permutations.findByInput(kept.input) ?? tokens.getPermutation();               // the default if it went
     * problem.permutations.findByInput({ mode: "dark" }) !== undefined;                   // found in mode: dark?
     */
    findByInput(input: Input): Permutation | undefined;
}

/**
 * Why {@link DesignTokens.getPermutation} found no permutation, with the facts its message is worded
 * from.
 */
export type PermutationErrorDetail = InputProblem | { reason: "not-read"; input: Input };

/**
 * Why a question of one permutation, such as {@link DesignTokens.getToken}, was asked of design
 * tokens with several, with the facts its message is worded from.
 */
export interface SeveralPermutationsDetail {
    /** What was asked, such as `"getToken()"` or `"tokens"`. */
    readonly asked: string;
    /** The resolver's modifiers. */
    readonly modifiers: readonly string[];
    /** An input that picks a permutation, for the message to show. */
    readonly example: Input;
}

/**
 * Why an input does not fit the resolver's modifiers (Resolver 5.2, 6.1): a modifier it doesn't
 * declare, a context that isn't a string or that the modifier doesn't declare, or a modifier with
 * no default left out. The read reports each as an `input-invalid` problem;
 * {@link DesignTokens.getPermutation} throws a {@link PermutationError} with the first.
 */
export type InputProblem = { readonly modifier: string } & (
    | {
          readonly reason: "unknown-modifier";
          /** The modifiers the resolver declares. */
          readonly valid: readonly string[];
      }
    | {
          readonly reason: "unknown-context";
          readonly context: string;
          /** The contexts the modifier allows. */
          readonly valid: readonly string[];
      }
    | {
          readonly reason: "missing-modifier";
          /** The contexts the modifier allows. */
          readonly valid: readonly string[];
      }
    | { readonly reason: "not-a-string" }
);

export type { ValueErrorCode, ValueErrorDetail, ValueErrorFacts } from "./values/value-errors.js";

/** Why a single value could not be read. */
export interface ValueError {
    kind: "invalid-value";
    /**
     * Where the problem is: the `jsonPath` the value was read at, then the steps into it, such as
     * `["$value", "color"]` in a shadow read at `["$value"]`.
     */
    jsonPath: JsonPath;
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
    jsonPath: JsonPath;
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

/** How values are read, for {@link read} and the parsers alike. */
export interface ParseOptions {
    /**
     * Reads a color written as a hex string, such as `"#e11d48"` or `"#e11d4880"`, as the sRGB
     * color it names, with the string kept as `hex`, and `dtcg/css` writes it as that string. Not
     * DTCG 2025.10, which writes every color as an object. Off, a hex string is a
     * `hex-string-color` error; on, one with three or four digits is an `invalid-value` giving the
     * six or eight digits it stands for.
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
    appliesTo: readonly (TokenType | "group")[];
    /** A schema the extension must pass. It must validate synchronously. */
    schema?: StandardSchemaV1;
    /** The wording for each reason `validate` reports. */
    messages?: ExtensionMessages;
    /**
     * Why the extension is not valid, if it is not. An error's `jsonPath` starts at the extension.
     * An {@link ExtensionError} is worded from `messages`; a {@link ValueError}, from reading a
     * value in the extension with `parseValue`, is reported as `invalid-value`; an
     * {@link IgnoredProperty} from the same, as an `unknown-property` warning. `options` are how
     * the read reads values, to read the extension's the same way: give them to `createExtensionReader`
     * or `parseValue`.
     */
    validate?(
        on: {
            /** Absent for the top level of a file. */
            path?: string;
            /** The token's type, or `"group"`. */
            type: TokenType | "group";
        },
        extension: unknown,
        options: ParseOptions,
    ): (ExtensionError | ValueError | IgnoredProperty)[];
}

/** A token a generator makes, written as it would be in a file, with its name in the group. */
export interface GeneratedToken {
    /**
     * Its name in the group, such as `"md"`. A name the specification forbids (Format 5.1.1), such
     * as one with a `.`, makes no token and is reported as `invalid-name`.
     */
    name: string;
    /** @default the group's type */
    $type?: TokenType;
    /**
     * As a file would write it, such as `{ value: 1, unit: "rem" }` for a size: plain JSON, not a
     * value read from a token, whose shape can differ (a stroke style written `"solid"` is read as
     * `{ kind: "keyword", keyword: "solid" }`).
     */
    $value: JsonValue;
    $description?: string;
    $extensions?: Record<string, JsonValue>;
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
 * { jsonPath: ["ratio", "min"], reason: "ratio-not-above-one", data: { ratio: 1 } }
 */
export type ExtensionError<M extends ExtensionMessages = ExtensionMessages> = string extends keyof M
    ? {
          /** Where in the extension, such as `["ratio", "min"]`. */
          jsonPath: JsonPath;
          reason: string;
          data?: unknown;
      }
    : {
          [R in keyof M & string]: {
              /** Where in the extension, such as `["ratio", "min"]`. */
              jsonPath: JsonPath;
              reason: R;
          } & (Parameters<M[R]> extends [] ? { data?: undefined } : { data: Parameters<M[R]>[0] });
      }[keyof M & string];

/**
 * Makes tokens from an extension on a group, such as the steps of a spacing scale. The extension
 * owns every token it makes: each is marked {@link TokenBase.generated | generated}, whether a file
 * writes it or not.
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
    extension: readonly [string, ...string[]];
    /**
     * A schema the extension must pass before `generate` sees it, from any library that implements
     * Standard Schema. Each issue is reported as `extension-invalid` with the library's message,
     * and `generate` is not called. It must validate synchronously.
     */
    schema?: StandardSchemaV1;
    /** The wording for each reason `generate` reports. */
    messages?: ExtensionMessages;
    /**
     * The tokens an extension makes, in the order to list them, or why the extension is not valid.
     * Tokens no file writes are listed at the end of the group. An error's `jsonPath` starts at the
     * extension. An {@link ExtensionError} is reported as `extension-invalid`, worded from
     * `messages`; a {@link ValueError}, from reading a value in the extension with `parseValue`, is
     * reported as `invalid-value`, as it would be in a token, and each of its `ignored` properties
     * as an `unknown-property` warning. With a `schema`, the extension is the
     * schema's output. A group whose extension is not valid gets no tokens added. The extension is
     * plain JSON, so whole-number keys inside it come first, in numeric order, whatever order the
     * file writes them in. `options` are how the read reads values, to read the extension's the
     * same way: give them to `createExtensionReader` or `parseValue`.
     */
    generate(
        group: {
            /** Absent for the top level of a file. */
            path?: string;
            /**
             * The type its tokens take, as {@link Group.type} gives it: its own, else the group it
             * extends, else the group it is inside (Format 6.7.3). Absent when none declares one.
             */
            type?: TokenType;
        },
        extension: unknown,
        options: ParseOptions,
    ):
        | { ok: true; value: GeneratedToken[]; ignored?: IgnoredProperty[] }
        | { ok: false; errors: (ExtensionError | ValueError)[]; ignored?: IgnoredProperty[] };
}

/**
 * How the design tokens are read: which permutations, the tools that make or check tokens, and how
 * values are read.
 */
export interface ReadOptions extends ParseOptions {
    /**
     * Which permutations to build, by their inputs (Resolver 5: "any selection of context values
     * passed to the tool"): these inputs, where modifiers left out take their default and an input
     * that does not fit the resolver is reported and not built; `"all"`, every combination of
     * contexts; or `"each-context"`, each context on its own, with every other modifier at its
     * default. An input must choose a context for each modifier with no default (Resolver 6.1),
     * so `"each-context"` builds each context once for every combination of those modifiers'
     * contexts. When modifiers change different tokens (Resolver 2.1), every combination can be
     * put together from `"each-context"`, as a stylesheet with one block per context does.
     *
     * @example
     * read(file, { inputs: [{ mode: "dark" }] })  // just mode: dark
     * read(file, { inputs: "each-context" })      // the default, then each context once
     * @default "all"
     */
    inputs?: readonly Input[] | "all" | "each-context";
    /**
     * The most combinations `"all"` builds. Above it, `"each-context"` is built instead, and a
     * `permutation-limit` warning says so. Each combination is built in full, so a read grows with
     * them: at the default, a few hundred tokens still read inside a 16 ms frame.
     * @default 32
     */
    permutationLimit?: number;
    /** Checks for your own `$extensions` keys, run in each permutation once types are known. */
    extensionValidators?: readonly ExtensionValidator[];
    /**
     * Generators that add tokens from extensions on groups. Run in order, in
     * each permutation, before values are read.
     */
    generators?: readonly Generator[];
    /**
     * Called as each stage of reading finishes, with how long it took. For progress and benchmarks.
     */
    onStage?: (stage: "load" | "generate" | "normalise" | "resolve", milliseconds: number) => void;
}

/**
 * Returns the text of a file, given its path.
 *
 * It is asked for each file by the entry's folder, as you gave it, joined with the file's path
 * from there: reading `"tokens/tokens.resolver.json"` asks for `"tokens/dark.json"`. A path
 * that is absolute or a URL is passed as written. Give `undefined` for a file that is not there,
 * which is reported as not found; throw, or reject, for one that could not be fetched, which
 * rejects the read.
 *
 * Every file path in the results, in `DesignTokens.files` and every `Span`, is relative to the
 * entry's folder, with forward slashes, such as `"themes/dark.json"`; one written from the root or
 * as a URL stays as written. The entry itself is its file name. That name is passed as `file`, for
 * keeping each text by the name the results use, and {@link getFilePath} turns it back into `path`.
 *
 * @example
 * const texts = new Map<string, string>();
 * const tokens = await read("tokens/tokens.resolver.json", {
 *   readText: async (path, file) => {
 *     const text = await readFile(path, "utf8");
 *     texts.set(file, text); // "dark.json"
 *     return text;
 *   },
 * });
 */
export type ReadText = (path: string, file: string) => Promise<string | undefined>;

/**
 * Design tokens as text in memory: each file's text by its name, and the file to start from, as
 * {@link readFromMemory} takes them and {@link DesignTokens.toMemory} gives them.
 */
export interface TokensInMemory {
    readonly files: Readonly<Record<string, string>>;
    /**
     * The file to start from.
     * @default the one resolver among the files, or else the only file
     */
    readonly entryFile?: string | undefined;
}

/** A token or group whose path changed, such as after a rename. */
export interface Move {
    readonly from: string;
    readonly to: string;
}

/** A property a file can set on a token, named as the spec names it, without the `$`. */
export type TokenProperty = "value" | "type" | "description" | "deprecated" | "extensions";

/**
 * A property a file can set on a group, named as {@link TokenProperty} names them: `extends` is
 * the group it takes tokens from, {@link Group.extends}.
 */
export type GroupProperty = "type" | "description" | "deprecated" | "extensions" | "extends";

/** A property a file can set on its top level. */
export type TopLevelProperty = "type" | "description" | "deprecated" | "extensions";

/**
 * What a file writes for a token: its value exactly as written, and the properties it writes
 * itself.
 */
export interface WrittenToken extends Written {
    readonly value?: unknown;
}

/**
 * What a file writes for a group: the properties it writes itself, and the path its `$extends`
 * names.
 */
export interface WrittenGroup extends Written {
    readonly extends?: string;
}

/**
 * One difference between two reads of the design tokens, in the permutations it holds in. `before`
 * and `after` are what the files wrote, the same in each of those permutations; for a token in one
 * of them, ask it: `dark.getToken(change.path)`. `changed`, `renamed`, `group-changed` and
 * `group-renamed` list the properties that differ; a rename with nothing else changed lists none.
 * Groups are reported on their own, empty ones included, and so are the tokens inside them. A token
 * a {@link Generator} makes says so (`generated`), with nothing written on either side: its change
 * is the extension's, on its group. One a group takes through `$extends` says so too (`inherited`).
 *
 * @example
 * for (const change of tokens.getChangesSince(before)) {
 *     row(change.kind, change.path, change.permutations.label);
 * }
 */
export type Change =
    | ({
          readonly kind: "added";
          readonly path: string;
          readonly after: WrittenToken;
      } & TokenChange)
    | ({
          readonly kind: "removed";
          readonly path: string;
          readonly before: WrittenToken;
      } & TokenChange)
    | ({
          readonly kind: "changed";
          readonly path: string;
          readonly properties: readonly TokenProperty[];
          readonly before: WrittenToken;
          readonly after: WrittenToken;
      } & TokenChange)
    | ({
          readonly kind: "renamed";
          readonly from: string;
          readonly path: string;
          readonly properties: readonly TokenProperty[];
          readonly before: WrittenToken;
          readonly after: WrittenToken;
      } & TokenChange)
    | ({
          readonly kind: "group-added";
          readonly path: string;
          readonly after: WrittenGroup;
      } & GroupChange)
    | ({
          readonly kind: "group-removed";
          readonly path: string;
          readonly before: WrittenGroup;
      } & GroupChange)
    | ({
          readonly kind: "group-changed";
          readonly path: string;
          readonly properties: readonly GroupProperty[];
          readonly before: WrittenGroup;
          readonly after: WrittenGroup;
      } & GroupChange)
    | ({
          readonly kind: "group-renamed";
          readonly from: string;
          readonly path: string;
          readonly properties: readonly GroupProperty[];
          readonly before: WrittenGroup;
          readonly after: WrittenGroup;
      } & GroupChange)
    | {
          readonly kind: "top-level-changed";
          /** The top level has no path. */
          readonly path?: undefined;
          readonly permutations: Permutations;
          readonly properties: readonly TopLevelProperty[];
          readonly before: Written;
          readonly after: Written;
      };

/** What every change to a token carries beside its sides. */
export interface TokenChange {
    readonly permutations: Permutations;
    /** Set when a {@link Generator} makes the token, as {@link TokenBase.generated}. */
    readonly generated?: Token["generated"];
    /** Set when the token is here only through `$extends`, as {@link TokenBase.inherited}. */
    readonly inherited?: Token["inherited"];
}

/** What every change to a group carries beside its sides. */
export interface GroupChange {
    readonly permutations: Permutations;
    /** Set when the group is here only through `$extends`, as {@link Group.inherited}. */
    readonly inherited?: Group["inherited"];
}

/** A JSON object, such as a DTCG file's top level: every value in it is plain JSON. */
export type JsonObject = { readonly [key: string]: JsonValue };

/** Any value that can be written in a DTCG file. */
export type JsonValue =
    | string
    | number
    | boolean
    | null
    | readonly JsonValue[]
    | { readonly [key: string]: JsonValue };
