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
 * A file can write one name as a string. It's read as a list of one.
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
 * A file can write one shadow as an object. It's read as a list of one.
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
 * A reference as {@link DesignTokens.getReferencesTo} gives it.
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
 * Each step is a key, or an index into a list.
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
     * Without `property`, it's the reference written as the whole value. It gives `undefined` if a
     * value is written there.
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
 * A definition as {@link DesignTokens.getDefinitions} gives it.
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
 * One source of tokens, as the resolver lists it: a file, part of one, or tokens written in the
 * resolver. Keys written beside a source's `$ref` are part of that source, so a token written there
 * belongs to it, and its place is in the resolver. One object for each source the resolver lists,
 * per context that lists it (a set several contexts pull in gives one for each), shared by every
 * permutation that reads it: {@link DesignTokens.sources} lists each once.
 */
export interface Source {
    /** The file its tokens are written in, or the resolver for tokens written there. */
    readonly file: string;
    /**
     * Set when the source is only part of the file, such as `"#/color"`. Tokens written in the
     * resolver are part of it too, so theirs says where they sit, such as
     * `"#/resolutionOrder/0/sources/1"`. Absent when the source is a whole file.
     */
    readonly pointer?: string;
    /**
     * The modifier whose contexts list it, when the resolver lists it under one, as
     * {@link DesignTokens.resolver} holds it. The context is the permutation's: a file the contexts
     * `dark` and `dim` both list the same way is one source, read through `dark` in the dark
     * permutation and through `dim` in the dim one. "Did a context's own file write this?" is this.
     *
     * @example
     * const source = dim.getToken("color.text")?.winningDefinition.source;
     * source?.modifier?.name                                            // "mode"
     * dim.contexts.find(({ modifier }) => modifier === source?.modifier) // the context dim
     */
    readonly modifier?: ResolverModifier;
    /**
     * Every set on the way to it, outermost first, each as it is in effect at that step. Empty
     * when it is reached through none, or there is no resolver.
     *
     * @example
     * source.sets // [{ name: "base" }, { name: "palette" }]: palette, which base names
     */
    readonly sets: readonly SetOnRoute[];
    /**
     * The source's own vendor data, passed through untouched: the `$extensions` written beside its
     * `$ref`, or else those at the top of its file. A set's and a modifier's stay on them, in
     * {@link DesignTokens.resolver}.
     */
    readonly extensions?: Readonly<Record<string, JsonValue>>;
    /**
     * Who reads it: `"every-context"` when a set `resolutionOrder` names reaches it, otherwise each
     * context whose permutations read it. Every context the resolver declares counts, including
     * those whose permutations the read didn't build. For deciding which file an edit belongs in.
     *
     * @example
     * source.readBy // [the context mode: dark]
     */
    readonly readBy: "every-context" | readonly ResolverContext[];
}

/**
 * A set a source was reached through, as it is in effect at that step of the route: its name, which
 * finds its entry in {@link DesignTokens.resolver}, and its `$extensions`, those written beside the
 * `$ref` that named it there when there are any, as keys beside a `$ref` replace the target's
 * (Resolver 4.2.2), otherwise its own.
 *
 * @example
 * // base's sources: [{ "$ref": "#/sets/palette", "$extensions": { "sh.sugarcube": { "emit": false } } }]
 * { name: "palette", extensions: { "sh.sugarcube": { emit: false } } }
 */
export interface SetOnRoute {
    readonly name: string;
    readonly extensions?: Readonly<Record<string, JsonValue>>;
}

/**
 * What the resolver says about itself and how it is put together (Resolver 4): its name and
 * description, the spec version it declares, and the sets and modifiers that take part, each as it
 * is in effect where `resolutionOrder` names it, with keys written beside that `$ref` applied
 * (Resolver 4.2.2), and where it is written. A set named inside another set with keys beside its
 * `$ref` is listed as it is defined; what those keys change is on each source's route
 * ({@link SetOnRoute}), since each such reference can change it differently.
 * A set or modifier `resolutionOrder` never reaches takes no part (Resolver 4.1.6): it is left out
 * here and reported as a hint. A set a source points inside of, such as `#/sets/palette/sources/0`,
 * is left out too, as it doesn't take part as a set, but isn't reported, as part of it is read.
 *
 * @example
 * tokens.resolver?.name                         // "Acme"
 * tokens.resolver?.modifiers.map(({ name }) => name) // ["mode", "density"]
 */
export interface Resolver {
    /** The resolver, as {@link DesignTokens.files} names it. */
    readonly file: string;
    /** The spec version the resolver declares, such as `"2025.10"`. */
    readonly version?: string;
    readonly name?: string;
    readonly description?: string;
    /** The sets that take part, in the order they are written. */
    readonly sets: readonly ResolverSet[];
    /** The modifiers that take part, in the order they are written. */
    readonly modifiers: readonly ResolverModifier[];
    /** `resolutionOrder`, each item by its name. */
    readonly resolutionOrder: readonly ({ readonly set: string } | { readonly modifier: string })[];
}

/** A set that takes part, as it is in effect. */
export interface ResolverSet {
    readonly name: string;
    readonly description?: string;
    /** The set's own `$extensions`, passed through untouched. */
    readonly extensions?: Readonly<Record<string, JsonValue>>;
    /** Its sources, in order, as written. */
    readonly sources: readonly SourceRef[];
    /** Where it is written: under `sets`, or inline in `resolutionOrder`. */
    readonly span: Span;
}

/** A modifier that takes part, as it is in effect. */
export interface ResolverModifier {
    readonly name: string;
    readonly description?: string;
    /** The modifier's own `$extensions`, passed through untouched. */
    readonly extensions?: Readonly<Record<string, JsonValue>>;
    /** Its contexts, in the order they are written, each with its sources. */
    readonly contexts: readonly ResolverContext[];
    readonly default?: string;
    /** Where it is written: under `modifiers`, or inline in `resolutionOrder`. */
    readonly span: Span;
}

/** One context of a modifier: one of the values an input can choose for it (Resolver 4.1.5.1). */
export interface ResolverContext {
    readonly name: string;
    /** The modifier it belongs to. */
    readonly modifier: ResolverModifier;
    /** Its sources, in order, as written. */
    readonly sources: readonly SourceRef[];
    /**
     * Whether it is its modifier's `default` (Resolver 4.1.5.3). A modifier need not declare one,
     * and then none of its contexts is.
     */
    readonly isDefault: boolean;
    /** Where it is written. */
    readonly span: Span;
}

/**
 * A source as the resolver writes it: a file, or part of one, as {@link DesignTokens.files} names
 * it, or a set it names. Tokens written in the resolver are part of the resolver, with a pointer to
 * where they sit.
 *
 * @example
 * { file: "dark.json" }
 * { file: "all.json", pointer: "#/dark" }
 * { set: "palette" }
 */
export type SourceRef =
    | { readonly file: string; readonly pointer?: string }
    | { readonly set: string };

/** The tokens that result from one input. */
export interface Permutation {
    /**
     * The input that names it: the context it picks for every modifier, defaults included, as
     * `getPermutation(input)` takes it.
     */
    readonly input: Input;
    /**
     * Its input written out for people: every modifier and its context, in the order
     * `resolutionOrder` names them, such as `"theme: dark, brand: house"`, the default permutation
     * included. The same text as the {@link Permutations.label | label} of a list holding only
     * this permutation, so a label always means the same permutations. Empty when there are no
     * modifiers, as for a token file: there is nothing to name, and nothing to tell apart. For
     * display only: functions take an {@link Input}, never a label.
     */
    readonly label: string;
    /**
     * Where the tokens come from, in the order they apply: a later source overrides an earlier one.
     */
    readonly sources: readonly Source[];
    /**
     * The context it picks for each modifier, in the order `resolutionOrder` names them, as its
     * {@link Permutation.label | label} lists them: what its {@link Permutation.input | input}
     * chooses (Resolver 5), defaults filled in. Empty without modifiers.
     *
     * @example
     * permutation.contexts.filter((context) => !context.isDefault) // what sets it apart
     */
    readonly contexts: readonly ResolverContext[];
    /**
     * Whether every modifier is at its `default` (Resolver 4.1.5.3): the permutation an empty input
     * names, since only a modifier with a default may be left out (Resolver 6.1). False for every
     * permutation when a modifier has no default; true for the one permutation of a token file read
     * without a resolver.
     *
     * @example
     * const others = tokens.permutations.select((p) => !p.isDefault);
     */
    readonly isDefault: boolean;
    /**
     * What the top of the files writes: its `$type`, `$description`, `$deprecated` and
     * `$extensions`. Not a `$root` token, which stands for its group (Format 6.2).
     */
    readonly topLevel: TopLevel;
    /**
     * The tokens and groups at the top level of the files, in the order they are read: where a
     * tree starts, walked like a group's {@link Group.children | children}.
     *
     * @example
     * for (const child of permutation.children) show(child);
     */
    readonly children: readonly (Token | Group)[];
    /**
     * Every token, in the order the files write them, invalid ones included. The files read as
     * one: a group's tokens stay together where the group is first written, whichever file adds
     * them, and a token a later file replaces keeps its place. Tokens a group inherits, or a
     * {@link Generator} adds, come at the end of their group. To find one by path, use
     * {@link Permutation.getToken | token}.
     */
    readonly tokens: readonly Token[];
    /**
     * Every group, in the same order as {@link Permutation.tokens | tokens}. To find one by path,
     * use {@link Permutation.getGroup | group}.
     */
    readonly groups: readonly Group[];
    /**
     * The token at `path`, or `undefined` when this permutation has none there: no token at all, a
     * group, or one only another permutation has.
     *
     * @example
     * dark.getToken("color.text")?.resolved
     */
    getToken(path: string): Token | undefined;
    /**
     * The group at `path`, or `undefined` when this permutation has none there.
     *
     * @example
     * dark.getGroup("color")?.children
     */
    getGroup(path: string): Group | undefined;
    /**
     * Whatever this permutation has at `path`: its token, else its group, else `undefined`. Each
     * says which it is in `kind`.
     *
     * @example
     * const here = dark.getTokenOrGroup(path);
     * if (here?.kind === "group") showGroup(here);
     */
    getTokenOrGroup(path: string): Token | Group | undefined;
    /**
     * Every reference to `path` in this permutation, each with the token or group that writes it in
     * `writtenIn`; with `chained`, also every reference to each of those, however indirectly, each once,
     * safe with loops. A group's path covers what is written to it, such as an `$extends`, and to
     * everything inside it. {@link DesignTokens.getReferencesTo} asks the same of the whole read.
     *
     * @example
     * dark.getReferencesTo("color.red").map(({ writtenIn }) => writtenIn.path) // ["color.brand"]
     * dark.getReferencesTo("color.red", { chained: true })           // everything a change would reach
     */
    getReferencesTo(path: string, options?: ReferenceOptions): readonly Reference[];
    /**
     * Each token or group the token or group at `path` refers to in this permutation, once,
     * however many references it writes to it: the mirror of {@link Permutation.getDependents}.
     * With `chained`, also each one those refer to, however indirectly, safe with loops. For a
     * property-level reference, the token holding the property; for a group, the group its
     * `$extends` names. Empty for a path that isn't there. The references themselves are the
     * token's or group's {@link TokenBase.references | references}.
     *
     * @example
     * light.getDependencies("color.text").map(({ path }) => path)                   // ["color.brand"]
     * light.getDependencies("color.text", { chained: true }).map(({ path }) => path) // ["color.brand", "color.red"]
     */
    getDependencies(path: string, options?: ReferenceOptions): readonly (Token | Group)[];
    /**
     * Each token or group that refers to `path` in this permutation, once, however many references
     * it writes to it; with `chained`, also each one that refers to those, however indirectly. Wider
     * than the spec's aliases (Format 3.8), tokens whose whole value is another: a composite with one
     * part referring to it, or a group's `$extends`, uses it too.
     *
     * @example
     * dark.getDependents("color.red").map(({ path }) => path) // ["color.brand", "border.danger"]
     */
    getDependents(path: string, options?: ReferenceOptions): readonly (Token | Group)[];
    /**
     * The problems about the token or group at `path` in this permutation: its own, a missing
     * reference it writes, a loop it is part of, a problem in a value it inherits. Those only
     * another permutation has are left out.
     *
     * @example
     * for (const problem of dark.getDiagnostics("color.brand")) show(problem.message);
     */
    getDiagnostics(path: string): readonly Diagnostic[];
}

/**
 * The facts each kind of diagnostic carries, so a tool can word diagnostics itself without
 * parsing {@link Diagnostic.message}.
 */
export interface DiagnosticDetailByKind {
    /** A file could not be fetched. */
    "file-not-found": {
        readonly file: string;
        /** The file that names it, when it is not the entry. */
        readonly referencedFrom?: string;
    };
    /**
     * A file is not valid JSON (or, for a resolver, JSON with comments), or its top level is not an
     * object.
     */
    "invalid-json": { readonly reason: JsonErrorReason };
    /** A key is written twice in one object. The last one is used. */
    "duplicate-key": { readonly key: string };
    /** The resolver breaks a rule of the resolver specification. */
    "resolver-invalid": ResolverProblem;
    /** An input does not fit the resolver's modifiers. */
    "input-invalid": {
        /** Which input, as its index in {@link ReadOptions.inputs}. */
        readonly input: number;
    } & InputProblem;
    /** A token or group name uses a character the specification forbids. */
    "invalid-name": { readonly name: string; readonly character: "." | "{" | "}" | "$" };
    /**
     * Something is both a token and a group: an object has a `$value` and also holds `child`; one
     * file declares a token where another declares a group (`here` says which this place is, and
     * `relatedInformation` where the other is); or an object's `$ref` points at a token, making it one, and it
     * also holds tokens or groups.
     */
    "token-and-group":
        | { readonly reason: "child"; readonly child: string }
        | { readonly reason: "declared"; readonly here: "token" | "group" }
        | { readonly reason: "ref"; readonly ref: string };
    /** Something inside a group is neither a token nor a group: it is not an object. */
    "invalid-member": {
        readonly name: string;
        readonly found: "string" | "number" | "boolean" | "null" | "array";
    };
    /**
     * A property the specification defines, such as `$description`, holds the wrong kind of JSON.
     */
    "invalid-property": {
        readonly property:
            | "$type"
            | "$description"
            | "$deprecated"
            | "$extensions"
            | "$extends"
            | "$ref";
        /** `"reference"`: a `"{group}"` reference, or a `{ "$ref": "#/…" }` pointer. */
        readonly expected: "string" | "object" | "boolean-or-string" | "reference";
        /**
         * For `$extends` written as a plain name, such as `base`, that name as a reference:
         * `{base}`.
         */
        readonly reference?: string;
    };
    /** No type can be worked out for a token. */
    "missing-type": Record<string, never>;
    /** A `$type` is not one of the thirteen the specification defines (Format 8). */
    "unknown-type": {
        readonly type: string;
        /** A type with a similar name, when exactly one is close. */
        readonly similar?: TokenType;
    };
    /** A value does not fit its type. */
    "invalid-value": {
        /** Where in the token or group, such as `["$value", "unit"]`. */
        readonly jsonPath: JsonPath;
    } & ValueErrorDetail;
    /** A color written as a hex string, which the 2025.10 Color module no longer allows. */
    "hex-string-color": ValueErrorFacts["hex-string"];
    /** An `$extensions` entry fails a registered check, such as a {@link Generator}'s. */
    "extension-invalid": {
        /** The `$extensions` key, such as `"com.example"`. */
        readonly key: string;
        /** Where in the token or group, such as `["$extensions", "com.example", "steps"]`. */
        readonly jsonPath: JsonPath;
        /** Why, as the check named it. A Standard Schema's issues have none. */
        readonly reason?: string;
        /** The facts the check's message is worded from. */
        readonly data?: unknown;
    };
    /**
     * A file writes a token or group with a name a {@link Generator} makes. The generator owns
     * every name it makes, so the generated token is used and what the file writes there is not;
     * `relatedInformation` is the extension that makes it.
     */
    "written-generated": {
        /** The name, such as `"space.2"`. */
        readonly path: string;
        /**
         * The group it is made in, absent for the top level of a file. A group that extends
         * another makes its tokens too, so this may not be the group that writes the extension.
         */
        readonly from?: string;
        /** The generator's extension, such as `["com.example", "steps"]`. */
        readonly extension: readonly [string, ...string[]];
        /** What the file writes with that name. */
        readonly written: "token" | "group";
    };
    /** A reference points at nothing: no token, or for `$extends`, no group. */
    "missing-reference": {
        /** The reference as written, without braces: a path such as `color.brnad`, or a pointer. */
        readonly ref: string;
        /**
         * Every token or group that writes it, each as a reference's
         * {@link ReferenceBase.writtenIn | from}.
         */
        readonly from: readonly string[];
        /**
         * `ref` written to a token with a similar path instead, when exactly one is close: a path,
         * or for a pointer, the pointer to that token with the same steps into its value. Not given
         * when the token a pointer names exists, as then a step inside its value is what is wrong.
         */
        readonly similar?: string;
    };
    /** `$extends`, or a `$ref` standing for a group, points at a token (Format 6.4.6). */
    "not-a-group": { readonly ref: string };
    /**
     * A `$ref` is not a JSON Pointer (RFC 6901): it does not start with `/` after the `#`, or a `~`
     * in it is not `~0` or `~1`.
     */
    "malformed-pointer": {
        readonly ref: string;
        readonly reason: "no-leading-slash" | "bad-escape";
        /**
         * The reference written correctly, when that reaches something, and always for a reference
         * into another file, whose target is not read.
         */
        readonly corrected?: string;
    };
    /**
     * A reference to a token points at a group (Format 6.2: `{color.accent}` names a group, not a
     * token).
     */
    "not-a-token": { readonly ref: string };
    /**
     * A reference in a shadow or gradient list points at a token holding several layers or stops.
     * A reference in such a list stands for one (Format 9.1, 9.6, 9.7).
     */
    "reference-to-several": {
        readonly ref: string;
        /** How many layers or stops the token holds. */
        readonly count: number;
    };
    /**
     * References that lead back to where they started; `toTopLevel` when the last refers to the
     * whole document.
     */
    "circular-reference": {
        readonly chain: readonly string[];
        readonly toTopLevel?: true;
    };
    /** A reference points at a token of the wrong type. */
    "type-mismatch": {
        readonly ref: string;
        readonly expected: TokenType;
        readonly found: TokenType;
    };
    /** A name starts or ends with a space: legal, but almost always a typo. */
    "whitespace-in-name": { readonly name: string };
    /**
     * An object has a key the specification does not define for it, so it is ignored: in a
     * resolver, a `$` name on a token or group, or in a value, such as `paragraphSpacing` in a
     * typography value. Your own data belongs in `$extensions`.
     */
    "unknown-property":
        | {
              readonly property: string;
              readonly owner: "resolver" | "set" | "modifier" | "token" | "group";
              /** A property it may have with a similar name, when exactly one is close. */
              readonly similar?: string;
          }
        | {
              readonly property: string;
              /**
               * The type of the value it is in, which for a part of a composite is the part's type.
               */
              readonly type: TokenType;
              /** Where in the token or group, such as `["$value", "paragraphSpacing"]`. */
              readonly jsonPath: JsonPath;
          };
    /**
     * A member is almost certainly one of the specification's own properties written another way:
     * without its `$`, in other capitals, or with a letter out (`value`, `$Value` or `$vlaue` for
     * `$value`). It is read as that property, so the token is not lost or read as a group, and
     * nothing that depends on it fails as well (Format 5, 6).
     */
    "misspelt-property": {
        readonly written: string;
        readonly property: "$value" | "$type" | "$description" | "$deprecated" | "$extensions";
        readonly owner: "token" | "group";
    };
    /** A reference points at a token marked `$deprecated`. */
    "deprecated-reference": { readonly ref: string; readonly reason?: string };
    /**
     * A resolver has more combinations than `permutationLimit`, so `"each-context"` was built
     * instead.
     */
    "permutation-limit": {
        /** How many combinations the resolver's modifiers make. */
        readonly count: number;
        readonly limit: number;
        /** How many were built instead. */
        readonly built: number;
    };
    /**
     * A set or modifier the resolver declares that `resolutionOrder` never reaches, so it takes no
     * part (Resolver 4.1.6). A hint at where it is written, tagged `unnecessary` so an editor can
     * fade it.
     */
    "not-in-resolution-order": {
        readonly item: "set" | "modifier";
        readonly name: string;
    };
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
          readonly rule: Exclude<ResolverRule, "wrong-type">;
          /** The property, set, modifier, pointer or file concerned. */
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
 * What a diagnostic is about, as a stable name to switch on. Each has a page at
 * {@link Diagnostic.docsUrl}.
 */
export type DiagnosticKind = keyof DiagnosticDetailByKind;

/**
 * A problem or a note about the files. Reading carries on, so one read reports everything.
 * Checking `kind` narrows `detail` to that kind's facts.
 *
 * The message says what is wrong in plain words and, where the reader knows, what would mend it
 * ("did you mean `color.ink`?"); `detail` holds the same facts. It names no tool's command or flag,
 * and holds no location: that is in `span`, for the tool to present as it likes. The changes that
 * would mend a problem are made by `@sugarcube-sh/dtcg-edit`.
 *
 * @example
 * if (d.kind === "missing-reference") d.detail.similar // "color.ink"
 */
export type Diagnostic = DiagnosticOf<DiagnosticDetailByKind> & {
    readonly permutations: Permutations;
};

/**
 * A diagnostic with kinds of your own, in the same shape as {@link Diagnostic}, so a tool's own
 * checks can be reported in one list with the package's. Give it a map from each kind to the facts
 * it carries; checking `kind` narrows `detail`, as it does for {@link Diagnostic}. Choose kinds
 * that are not {@link DiagnosticKind | the package's}.
 *
 * @example
 * type Ours = DiagnosticOf<{ "selector-empty": { entry: number } }>;
 * const reported: (Diagnostic | Ours)[] = [...tokens.diagnostics, ...checkConfig(tokens)];
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
         * The permutations that have it. Always given on the package's own {@link Diagnostic}s, as
         * every answer gives them: each one that reads its file, every one for a problem in the
         * resolver or in no file (labelled `"everywhere"`), and none for a file no permutation the
         * read built reads (`"nowhere"`). A tool's own kinds may leave it out, for a problem that
         * concerns no permutation, such as one in the tool's own configuration.
         *
         * @example
         * const { label } = diagnostic.permutations;
         * show(label === "everywhere" ? diagnostic.message : `${diagnostic.message} in ${label}`);
         */
        readonly permutations?: Permutations;
        /**
         * Other places involved, such as every token that uses a missing one: each with its own
         * message, and the token or group written there, when one is. With {@link path}, every
         * token a tool could take someone to, whatever the kind.
         *
         * @example
         * const tokens = [diagnostic.path, ...(diagnostic.relatedInformation ?? []).map((each) => each.path)];
         */
        readonly relatedInformation?: readonly {
            readonly message: string;
            readonly span: Span;
            readonly path?: string;
        }[];
        /** How an editor may show it: struck through for a deprecated reference. */
        readonly tags?: readonly ("deprecated" | "unnecessary")[];
        /** A page explaining this kind of diagnostic. */
        readonly docsUrl: string;
        readonly detail: DetailByKind[K];
    };
}[keyof DetailByKind];

/**
 * Design tokens as the DTCG specifications define them: every permutation, with every value in one
 * shape and every reference followed. The tokens and groups link down and across, never up: a
 * group's {@link Group.children | children} are the tokens and groups themselves, and a reference's
 * `pointsToToken` the token it reaches; what is around a token, its group and who refers to it, is asked of
 * its permutation by path. A token or group that is the same in two permutations, written in the
 * same places, taking the same settings from its groups and reaching the same tokens, is one object
 * in both, so `===` tells whether it differs between them. `JSON.stringify` writes their plain
 * form, with a path wherever one links to another, and leaves out what the rest says: a group's
 * `rootToken` and `extends`, `kind`, a reference's `writtenIn`, `pointsToPath`, `pointsToToken` and
 * `pointsToProperty`, and where places and references are, which `getSpan` (`/editor`) gives.
 * Nothing changes them after {@link read} returns them: everything in them is read-only and
 * shared, so make a new value rather than changing one.
 */
export interface DesignTokens {
    /**
     * Every file the read used, the entry first, in the order they were read. For watching and
     * reloading. Paths are as described at {@link ReadText}.
     */
    readonly files: readonly string[];
    /**
     * The file the read started from, a resolver or a token file, by the name
     * {@link DesignTokens.files} gives it.
     */
    readonly entryFile: string;
    /** What the resolver says about itself and how it is put together; absent with no resolver. */
    readonly resolver?: Resolver;
    /**
     * Every source the read used, each once, in the order the permutations first read them. A
     * permutation's {@link Permutation.sources | sources} are among these, the same objects.
     */
    readonly sources: readonly Source[];
    /**
     * Every permutation the read built, in the resolver's order: modifiers as `resolutionOrder`
     * lists them, the first changing slowest (for `"each-context"`, each modifier's contexts in
     * turn), and each one's contexts as written, so the default permutation comes where its
     * contexts are written, not necessarily first. The spec sets no
     * order (Resolver 4.1.5.4); to find the default, ask {@link DesignTokens.getPermutation} with no
     * input. Its label is `"everywhere"`.
     */
    readonly permutations: Permutations;
    /**
     * How the values were read. To read a value from the design tokens again, such as one inside
     * `$extensions`, the same way, give these to `parseValue` or `createExtensionReader`.
     */
    readonly parseOptions: Required<ParseOptions>;
    /**
     * Every error, warning and note, in the order the read found them; sort by `span` for file
     * order. For those about one token or group,
     * {@link DesignTokens.getDiagnostics | getDiagnostics}; for those at a place in a file,
     * `getDiagnosticsAt` (`/editor`).
     *
     * @example
     * const errors = tokens.diagnostics.filter((d) => d.severity === "error");
     */
    readonly diagnostics: readonly Diagnostic[];
    /**
     * Every reference to `path` written in the files, each place once, with the permutations it
     * holds in and the tokens that have it: what renaming `path` rewrites, and whether anything
     * uses it at all, built or not. A group's path covers what is written to it, such as an
     * `$extends`, and to everything inside it. To follow chained references, which go through each
     * permutation's own tokens, ask a permutation ({@link Permutation.getReferencesTo}).
     *
     * @example
     * for (const { span } of tokens.getReferencesTo("color.brand")) rewrite(span);
     * const unused = tokens.getReferencesTo("color.legacy").length === 0;
     */
    getReferencesTo(path: string): readonly ReferenceInPermutations[];
    /**
     * Every place the token or group at `path` is written, in any permutation, each span once with
     * the sources and permutations that read it and the permutations whose value comes from it, in
     * the order first met: where to edit it, and where a change to its value would show.
     *
     * @example
     * for (const { span } of tokens.getDefinitions("color.brand")) rename(span);
     * for (const { span, winsIn } of tokens.getDefinitions("color.brand")) row(span.file, winsIn.label);
     */
    getDefinitions(path: string): readonly DefinitionInPermutations[];
    /**
     * The permutation for an input: modifiers left out take their default (Resolver 4.1.5.3), and
     * names match whatever their case (Resolver 5.1). With no input, the default permutation.
     *
     * @throws {@link PermutationError} when there is none: the input names a modifier or context
     * the resolver does not declare, leaves out a modifier that has no default (Resolver 6.1), or
     * names a permutation the read did not build. Its `detail` says which.
     *
     * @example
     * const dark = tokens.getPermutation({ mode: "dark" });
     */
    getPermutation(input?: Input): Permutation;
    /**
     * The token at `path`, when the read has one permutation: a token file, or a resolver with no
     * modifiers. As {@link Permutation.getToken}, of that permutation. With several, which one is
     * meant has to be said: pick one with {@link DesignTokens.getPermutation}, or ask every one with
     * {@link askEveryPermutation}.
     *
     * @throws {@link SeveralPermutationsError} when the read has several permutations.
     *
     * @example
     * const tokens = await read("color.json");
     * tokens.getToken("color.red")?.resolved
     */
    getToken(path: string): Token | undefined;
    /**
     * The group at `path`, when the read has one permutation. As {@link Permutation.getGroup}.
     *
     * @throws {@link SeveralPermutationsError} when the read has several permutations.
     */
    getGroup(path: string): Group | undefined;
    /**
     * The token or group at `path`, when the read has one permutation. As
     * {@link Permutation.getTokenOrGroup}.
     *
     * @throws {@link SeveralPermutationsError} when the read has several permutations.
     */
    getTokenOrGroup(path: string): Token | Group | undefined;
    /**
     * The tokens and groups that refer to `path`, when the read has one permutation. As
     * {@link Permutation.getDependents}. Whether anything uses it in any permutation, or one the read
     * didn't build, is whether {@link DesignTokens.getReferencesTo | getReferencesTo} gives any.
     *
     * @throws {@link SeveralPermutationsError} when the read has several permutations.
     */
    getDependents(path: string, options?: ReferenceOptions): readonly (Token | Group)[];
    /**
     * The tokens and groups `path` refers to, when the read has one permutation. As
     * {@link Permutation.getDependencies}.
     *
     * @throws {@link SeveralPermutationsError} when the read has several permutations.
     */
    getDependencies(path: string, options?: ReferenceOptions): readonly (Token | Group)[];
    /**
     * Every token, when the read has one permutation. As {@link Permutation.tokens}.
     *
     * @throws {@link SeveralPermutationsError} when the read has several permutations.
     */
    readonly tokens: readonly Token[];
    /**
     * Every group, when the read has one permutation. As {@link Permutation.groups}.
     *
     * @throws {@link SeveralPermutationsError} when the read has several permutations.
     */
    readonly groups: readonly Group[];
    /**
     * The tokens and groups at the top level, when the read has one permutation. As
     * {@link Permutation.children}.
     *
     * @throws {@link SeveralPermutationsError} when the read has several permutations.
     */
    readonly children: readonly (Token | Group)[];
    /**
     * What the top of the files writes, when the read has one permutation. As
     * {@link Permutation.topLevel}.
     *
     * @throws {@link SeveralPermutationsError} when the read has several permutations.
     */
    readonly topLevel: TopLevel;
    /**
     * Every token's path in any permutation, each once, in the order the permutations list them:
     * a token only a later permutation has comes after the earlier ones' tokens.
     *
     * @example
     * for (const path of tokens.getTokenPaths()) row(path, dark.getToken(path)?.resolved);
     */
    getTokenPaths(): readonly string[];
    /**
     * Every group's path in any permutation, each once, in the order the permutations list them.
     */
    getGroupPaths(): readonly string[];
    /**
     * Whether a token or group is at `path` in any permutation.
     *
     * @example
     * if (tokens.has("color.danger")) refuse("taken");
     */
    has(path: string): boolean;
    /**
     * The text of a file the read used, by the name {@link DesignTokens.files} gives it, exactly as
     * read; `undefined` for a file it did not use. What an editor shows, and what a format-keeping
     * edit changes.
     *
     * @example
     * const lines = tokens.getText("dark.json")?.split("\n");
     */
    getText(file: string): string | undefined;
    /**
     * The design tokens after some files change, read as these were: from the same file, with the
     * same options. `changed` gives each changed file's new text, a new file included, or `null`
     * for a file deleted, by the names {@link DesignTokens.files} gives them; every other file is
     * read as these read it. These design tokens are not changed. What an editor asks after
     * changing the text.
     *
     * @example
     * const next = tokens.reread({ "dark.json": edited });
     * const without = tokens.reread({ "tokens.resolver.json": withoutDim, "dim.json": null });
     */
    reread(changed: Readonly<Record<string, string | null>>): DesignTokens;
    /**
     * The design tokens read again from every file's text as it is now, from the same file and
     * with the same options: `files` holds each file by the name {@link DesignTokens.files} gives
     * it, and a file these read that `files` leaves out is read as deleted. These same design
     * tokens when no file's text differs, so a tool sent every file after each change can tell
     * that nothing did. What a host-fed editor asks; one that knows what it changed asks
     * {@link DesignTokens.reread}.
     *
     * @example
     * const next = tokens.rereadAll(received.files);
     * if (next !== tokens) show(next);
     */
    rereadAll(files: Readonly<Record<string, string>>): DesignTokens;
    /**
     * What to send to read these design tokens somewhere else, such as a browser or a worker: the
     * entry and the text of every file read, a {@link TokensInMemory} as {@link readFromMemory}
     * takes it. Read it there with the same options for the same design tokens; options can hold
     * functions, so they are not part of it.
     *
     * @example
     * send(tokens.toMemory());
     * const same = readFromMemory(received, options);
     */
    toMemory(): TokensInMemory & { readonly entryFile: string };
    /**
     * What changed since `before`, an earlier read, and in which permutations: tokens and groups
     * added, removed, renamed, or with different properties. A token is compared by what it says,
     * not what it resolves to, so changing one value is one change, not one for every token
     * pointing at it. The value is compared with {@link isEquivalentValue}, the type only where the token
     * writes `$type`, and the other properties exactly. A change that is the same in several
     * permutations, such as a value changed in a file they all read, is one entry listing them all.
     *
     * Tokens a generator made are included, with `generated` set, so a tool can show the change to
     * the extension on its group and fold its tokens under it. Tokens a group takes through
     * `$extends` are included the same way, with `inherited` set.
     *
     * Two reads alone cannot tell a rename from a removal and an addition. Pass the moves the edits
     * made, in the order they were made, and those tokens are listed as `renamed`; references the
     * moves rewrote are not changes, and a reference pointed somewhere else is.
     *
     * Each permutation is compared with the one its input names in `before`; a permutation `before`
     * has no match for is left out.
     *
     * @example
     * for (const change of tokens.getChangesSince(before, { moved })) row(change.kind, change.path);
     */
    getChangesSince(before: DesignTokens, options?: { moved?: readonly Move[] }): readonly Change[];
    /**
     * The problems about the token or group at `path`, in every permutation, each with the
     * permutations it is in: its own, a missing reference it writes (reported once however many
     * write it), a loop it is part of, a problem in a value it inherits (reported once, about the
     * token that writes it).
     *
     * @example
     * for (const { message, permutations } of tokens.getDiagnostics("color.brand")) {
     *   show(message, permutations?.label);
     * }
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
