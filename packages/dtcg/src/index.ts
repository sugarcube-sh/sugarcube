import type { StandardSchemaV1 } from "./standard-schema.js";
import type { ValueErrorDetail, ValueErrorFacts } from "./values/value-errors.js";

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
    readonly colorSpace: ColorSpace;
    /** The three channels, in the order the color space defines. */
    readonly components: readonly [ColorComponent, ColorComponent, ColorComponent];
    /**
     * Opacity, from 0 to 1.
     * @default 1
     */
    readonly alpha: number;
    /** A six-digit hex fallback for tools that cannot use the color space. */
    readonly hex?: string;
}

/** A length. */
export interface DimensionValue {
    readonly value: number;
    readonly unit: "px" | "rem";
}

/** A length of time. */
export interface DurationValue {
    readonly value: number;
    readonly unit: "ms" | "s";
}

/**
 * The control points of a cubic Bézier easing curve: `[x1, y1, x2, y2]`, with both x values from 0
 * to 1.
 */
export type CubicBezierValue = readonly [number, number, number, number];

/** Font names in order of preference. A single name is a list of one. */
export type FontFamilyValue = readonly string[];

/** A font weight from 1 to 1000. Keywords such as `"bold"` are read as their numbers. */
export type FontWeightValue = number;

/** A plain number, such as a line-height multiplier or an opacity. */
export type NumberValue = number;

/** A line style: either a keyword, or a custom dash pattern. */
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
          /** Alternating dash and gap lengths. */
          readonly dashArray: readonly DimensionValue[];
          /** How the end of each dash is drawn. */
          readonly lineCap: "round" | "butt" | "square";
      };

/** A border, made of a color, a width and a line style. */
export interface BorderValue {
    readonly color: ColorValue;
    readonly width: DimensionValue;
    readonly style: StrokeStyleValue;
}

/** One shadow. A shadow token contains a list of these. */
export interface ShadowLayer {
    readonly color: ColorValue;
    readonly offsetX: DimensionValue;
    readonly offsetY: DimensionValue;
    readonly blur: DimensionValue;
    readonly spread: DimensionValue;
    /**
     * Whether the shadow is drawn inside the element.
     * @default false
     */
    readonly inset: boolean;
}

/** A shadow: one or more layers. A single shadow is a list of one. */
export type ShadowValue = readonly ShadowLayer[];

/** One color stop in a gradient. */
export interface GradientStop {
    readonly color: ColorValue;
    /**
     * Where the stop sits along the gradient, from 0 to 1. Values outside that range are clamped.
     */
    readonly position: number;
}

/** A gradient, as its color stops. */
export type GradientValue = readonly GradientStop[];

/** A transition: how long, how late, and with what easing. */
export interface TransitionValue {
    readonly duration: DurationValue;
    readonly delay: DurationValue;
    readonly timingFunction: CubicBezierValue;
}

/** A complete typographic style. */
export interface TypographyValue {
    readonly fontFamily: FontFamilyValue;
    readonly fontSize: DimensionValue;
    readonly fontWeight: FontWeightValue;
    readonly letterSpacing: DimensionValue;
    /** A multiple of the font size. */
    readonly lineHeight: NumberValue;
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
 * A reference written in curly brace syntax (Format 7.1.1), `"{color.brand}"`: it stands for the
 * whole of the value of the token at `path`.
 *
 * @example
 * // "$value": "{color.brand}" is read as
 * { syntax: "curly-brace", path: "color.brand" }
 */
export interface CurlyBraceReference {
    readonly syntax: "curly-brace";
    /** The path of the token referred to. */
    readonly path: string;
}

/**
 * A reference written in JSON Pointer syntax (Format 7.1.2), `{ "$ref": "#/…" }`. It can point at
 * a whole token or inside its value, such as at one component of a color (Format 7.3).
 *
 * @example
 * // "components": [{ "$ref": "#/color/blue/$value/components/0" }, 0.5, 0.5]
 * // reads the first component as
 * { syntax: "json-pointer", pointer: "#/color/blue/$value/components/0" }
 */
export interface JsonPointerReference {
    readonly syntax: "json-pointer";
    /** The JSON Pointer, as written. */
    readonly pointer: string;
}

/**
 * A reference as it stands in a value, in either syntax. {@link isReference} tells one from a
 * value.
 */
export type WrittenReference = CurlyBraceReference | JsonPointerReference;

/**
 * A reference a token or group writes, in the permutation that holds it: what is written, where,
 * and the token it references. Each is listed in its token's
 * {@link TokenBase.references | references} and its group's {@link Group.references | references}.
 *
 * @example
 * // in mode: dark, "text": { "$value": "{color.brand}" }
 * const [reference] = text.references;
 * reference.path    // "color.brand"
 * reference.token   // dark's color.brand
 */
export type Reference = ReferenceBase &
    (CurlyBraceReference | (JsonPointerReference & { readonly path?: string }));

/** What every {@link Reference} has, whatever its syntax. */
export interface ReferenceBase {
    /**
     * The path it names: a token's, or a group's for a group's `$extends`; for a JSON Pointer to a
     * property within a value, the token holding it. Given even when nothing is at that path, so a
     * reference to a missing token can be found and moved. Absent for a pointer that names no path,
     * such as `#/` or one into another file.
     */
    readonly path?: string;
    /** The token or group that writes it. */
    readonly from: Token | Group;
    /**
     * The token it references as a whole, in this permutation: curly braces target complete
     * tokens only, a JSON Pointer any place (Format 7.1.2). `undefined` when it references none: a
     * property within a value (see {@link ReferenceBase.targetProperty | targetProperty}; the
     * token holding it is at `path`), a group, as a group's `$extends` does, or nothing at all.
     */
    readonly token?: Token;
    /**
     * For a property-level reference (Format 7.3), a JSON Pointer to a property within a token's
     * value, the property it targets. Absent when it references the complete value (Format
     * 7.4.2), as a curly brace reference always does.
     *
     * @example
     * // { "$ref": "#/color/blue/$value/components/0" }
     * reference.targetProperty // ["components", 0]
     */
    readonly targetProperty?: JsonPath;
    /**
     * The property of {@link TokenBase.value | value} it is written as, which can differ from the
     * file: a shadow written as one object is a list of one, so a reference in its `color` is at
     * `[0, "color"]`. Absent for a reference written as the whole value, and for a group's
     * `$extends`.
     */
    readonly property?: JsonPath;
    /**
     * What to write where it is written ({@link DesignTokens.spanOf}) after a list of
     * {@link Move}s, made in order, in the syntax it is written in: a JSON Pointer keeps its steps
     * into the value. As it is written when no move reaches it.
     *
     * @example
     * reference.moved([{ from: "color.brand", to: "color.house" }]) // "{color.house}"
     */
    moved(moves: readonly Move[]): JsonValue;
}

/**
 * A reference, as {@link DesignTokens.referencedBy} gives it: written once at `span`, holding in
 * each of `permutations`. `from` is the path that writes it,
 * since it can be a different token in each permutation.
 */
export type ReferenceInPermutations = Omit<ReferenceBase, "from" | "token" | "moved"> &
    (CurlyBraceReference | (JsonPointerReference & { readonly path?: string })) & {
        /** Where it is written, in this read's text. */
        readonly span: Span;
        /** Where it is written in its file, as {@link DesignTokens.jsonPathOf} gives it. */
        readonly jsonPath: JsonPath;
        readonly from: string;
        readonly permutations: Permutations;
        moved(moves: readonly Move[]): JsonValue;
    };

/**
 * One answer {@link everyPermutation} gives: what the question answered, and the permutations
 * that answered it.
 */
export interface AnswerInPermutations<Answer> {
    readonly answer: Answer;
    readonly permutations: Permutations;
}

/** How far a permutation's and the design tokens' reference questions look. */
export interface ReferenceOptions {
    /**
     * Follow chained references (Format 7.2.2): those through other tokens, however indirectly.
     * Each reference once, safe with loops.
     * @default false
     */
    chained?: boolean;
}

/**
 * `V`, with a {@link JsonPointerReference} allowed in place of the whole of it or any part of it.
 */
export type WithPointers<V> =
    | JsonPointerReference
    | (V extends object ? { [K in keyof V]: WithPointers<V[K]> } : V);

/**
 * A value whose references have not been followed yet: a {@link CurlyBraceReference} to a token
 * holding one, or the value with a {@link JsonPointerReference} in place of any part.
 */
export type Unresolved<V> = CurlyBraceReference | WithPointers<V>;

/**
 * A stroke style whose references have not been followed yet, where the specification allows them.
 */
export type UnresolvedStrokeStyle =
    | WrittenReference
    | Extract<StrokeStyleValue, { kind: "keyword" }>
    | {
          readonly kind: "dash";
          readonly dashArray: JsonPointerReference | readonly Unresolved<DimensionValue>[];
          readonly lineCap: JsonPointerReference | "round" | "butt" | "square";
      };

/**
 * Where the specification allows references in each type's value. A {@link CurlyBraceReference}
 * stands for a whole token, so it may take the place of the whole value, or of a part of a
 * composite that is a token type in its own right. A {@link JsonPointerReference} may take the
 * place of any part.
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
 * A value of type `T` in its one agreed shape, with its references not yet followed: the type of
 * {@link TokenBase.value | Token.value}. {@link TokenBase.resolved | Token.resolved} is the same
 * value with them followed, and {@link TokenBase.authored | Token.authored} is how the file wrote
 * it.
 */
export type UnresolvedValue<T extends TokenType> = UnresolvedValueByType[T];

export { isReference } from "./values/references.js";

/**
 * One part of a token's value: the whole value, a part of a composite, a shadow layer or gradient
 * stop, or a length in a dash pattern. Each is somewhere the spec lets a value or a reference to a
 * token stand. Checking `type` narrows `resolved` and the part's own parts.
 *
 * @example
 * const border = token.parts;
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
    /**
     * The property of {@link TokenBase.value | value} it is, as a reference's
     * {@link ReferenceBase.property | property} says; absent for the whole value.
     */
    readonly property?: JsonPath;
    readonly resolved: V;
    /**
     * The reference written at this place, if any. A pointer inside the part, such as at one
     * component of a color, is not at it: what it reaches is in `resolved`.
     */
    readonly ref?: Reference;
}

/** A part with no parts of its own. */
export interface SimplePart<T extends SimplePartType> extends PartBase<ValueByType[T]> {
    readonly type: T;
}

/**
 * A stroke style: a keyword, or a dash pattern with a part for each of its lengths. Checking
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

/** A border, as its color, width and style. */
export interface BorderPart extends PartBase<BorderValue> {
    readonly type: "border";
    readonly color: SimplePart<"color">;
    readonly width: SimplePart<"dimension">;
    readonly style: StrokeStylePart;
}

/** A transition, as its duration, delay and timing function. */
export interface TransitionPart extends PartBase<TransitionValue> {
    readonly type: "transition";
    readonly duration: SimplePart<"duration">;
    readonly delay: SimplePart<"duration">;
    readonly timingFunction: SimplePart<"cubicBezier">;
}

/** A shadow, as its layers. A single shadow has one. */
export interface ShadowPart extends PartBase<ShadowValue> {
    readonly type: "shadow";
    readonly layers: readonly ShadowLayerPart[];
}

/** One layer of a shadow. Its `ref` is a reference to a shadow token standing for the layer. */
export interface ShadowLayerPart extends PartBase<ShadowLayer> {
    readonly color: SimplePart<"color">;
    readonly offsetX: SimplePart<"dimension">;
    readonly offsetY: SimplePart<"dimension">;
    readonly blur: SimplePart<"dimension">;
    readonly spread: SimplePart<"dimension">;
}

/** A gradient, as its stops. */
export interface GradientPart extends PartBase<GradientValue> {
    readonly type: "gradient";
    readonly stops: readonly GradientStopPart[];
}

/** One stop of a gradient. Its `ref` is a reference to a gradient token standing for the stop. */
export interface GradientStopPart extends PartBase<GradientStop> {
    readonly color: SimplePart<"color">;
    readonly position: SimplePart<"number">;
}

/** A typographic style, as its five parts. */
export interface TypographyPart extends PartBase<TypographyValue> {
    readonly type: "typography";
    readonly fontFamily: SimplePart<"fontFamily">;
    readonly fontSize: SimplePart<"dimension">;
    readonly fontWeight: SimplePart<"fontWeight">;
    readonly letterSpacing: SimplePart<"dimension">;
    readonly lineHeight: SimplePart<"number">;
}

/**
 * A choice of context for each modifier, which is how every function names a permutation.
 * Modifiers left out take their default, and matching ignores case.
 *
 * @example
 * { theme: "dark" }
 * { theme: "dark", brand: "ocean" }
 */
export type Input = Readonly<Record<string, string>>;

/** A path into a JSON document, one key or index per step. */
export type JsonPath = readonly (string | number)[];

/**
 * A place in a file, for messages, editors and language servers: where it starts and how long it
 * is, and the line and column where it starts and ends. Lines and columns start at 1. Offsets,
 * lengths and columns count UTF-16 code units, as JavaScript strings do and as the Language Server
 * Protocol expects.
 */
export interface Span {
    readonly file: string;
    readonly offset: number;
    readonly length: number;
    readonly start: { readonly line: number; readonly column: number };
    readonly end: { readonly line: number; readonly column: number };
}

/** What every token has, whatever its type. */
export interface TokenBase<T extends TokenType> {
    /** Tells a token from a group: an object with `$value` is a token (Format 6.1). */
    readonly kind: "token";
    /**
     * Where the token sits in the tree, such as `"color.brand"`. A group's own `$root` token has
     * the path `"color.brand.$root"`, the way the spec writes a reference to it.
     */
    readonly path: string;
    /**
     * Its type: its own `$type`, else its group's (Format 6.7.3), else the type of the token its
     * whole value references.
     */
    readonly type: T;
    /**
     * The value, in one shape per type, with each reference kept as written
     * ({@link WrittenReference}). Absent when the token is {@link TokenBase.invalid | invalid}.
     */
    readonly value?: UnresolvedValue<T>;
    /**
     * The value with every reference followed. Absent when invalid or when a reference cannot be
     * followed.
     */
    readonly resolved?: ValueByType[T];
    /**
     * Set when the value could not be read. The reasons are in {@link DesignTokens.diagnostics},
     * under this token's path.
     */
    readonly invalid?: true;
    /** Its `$description`, as the file writes it. */
    readonly description?: string;
    /** `true`, or a message explaining what to use instead. */
    readonly deprecated?: boolean | string;
    /**
     * The group that writes the `$deprecated` in force, when the token doesn't write its own: the
     * closest group above it with one of its own or through the group it extends (Format 6.3.1,
     * 6.4). Absent when the token writes its own, when the top level of its file writes it, or when
     * none applies.
     *
     * @example
     * if (token.deprecated && token.deprecatedFrom) say(`Deprecated by ${token.deprecatedFrom}`);
     */
    readonly deprecatedFrom?: string;
    /**
     * Vendor data from `$extensions`, passed through untouched. Plain JSON, so whole-number keys
     * inside it come first, in numeric order, as in any JavaScript object.
     */
    readonly extensions?: Readonly<Record<string, JsonValue>>;
    /**
     * Every place the permutation's sources write the token, in the order they are read, the one
     * that wins last: a later source writes a token whole (Resolver 6.2). Usually one place. A
     * token a {@link Generator} adds is at the extension that makes it, and one inherited through
     * `$extends` where its value is written, in the group it comes from.
     *
     * @example
     * const winner = token.writtenAt.at(-1);
     * winner?.source.modifier // the modifier whose context's own file writes it, if one does
     */
    readonly writtenAt: readonly Place[];
    /**
     * What the file wrote for the properties a token can also take from elsewhere: its value
     * exactly as written, and its `$type` and `$deprecated` when it writes them itself, rather than
     * taking them from a group or, for the type, from the token it refers to. Its `$description`
     * and `$extensions` are always its own, so they are on the token and not repeated here. Absent
     * when no file writes the token: one a {@link Generator} added.
     */
    readonly authored?: { readonly value: JsonValue } & Pick<Written, "type" | "deprecated">;
    /**
     * Set when a {@link Generator} makes the token from an extension on the group at `from`,
     * whether a file writes the token or it was added. `from` is absent for an extension on the top
     * level of a file, and `extension` is where the extension sits in the group's `$extensions`, as
     * the generator names it. An added token has no {@link TokenBase.authored | authored}, and its
     * {@link TokenBase.writtenAt | place} is the extension.
     */
    readonly generated?: {
        readonly from?: string;
        readonly extension: readonly [string, ...string[]];
    };
    /**
     * Set when the token is here only because of `$extends`, or a `$ref` to another group, at
     * `from`.
     */
    readonly inherited?: { readonly from: string };
    /**
     * Each reference its value writes, in the order the value lists them, each with what it
     * references. Kept for a value that can't be read as a whole, since they are written whatever
     * else is wrong.
     *
     * @example
     * // a border written { "color": "{color.brand}", "width": "{border.thin}", "style": "solid" }
     * border.references.map(({ property, path }) => [property, path])
     * // [[["color"], "color.brand"], [["width"], "border.thin"]]
     */
    readonly references: readonly Reference[];
    /**
     * The reference written as one property of the value, as {@link ReferenceBase.property}
     * places it, or as the whole value when none is given; `undefined` when a value is written
     * there.
     *
     * @example
     * // a typography token written { "fontSize": "{size.xl}", … }
     * heading.referenceAt(["fontSize"])?.token // size.xl
     * alias.referenceAt()?.token                // the token its whole value references
     */
    referenceAt(property?: JsonPath): Reference | undefined;
    /**
     * The token, then each token its whole value references in turn, ending at the one that holds a
     * value: a curly brace reference, or a JSON Pointer to a complete value. A property-level
     * reference isn't followed. Stops at a reference to no token and at a loop, without repeating.
     *
     * @example
     * text.aliasChain.map(({ path }) => path) // ["color.text", "color.brand", "palette.red"]
     */
    readonly aliasChain: readonly Token[];
    /**
     * The place whose value wins: the last of {@link TokenBase.writtenAt | writtenAt}, as a later
     * source replaces a token whole (Resolver 6.2).
     *
     * @example
     * text.valueFrom.source.file     // "dark.json"
     * text.valueFrom.source.modifier // the modifier whose context's own file writes it, if one does
     * goTo(text.valueFrom.span)      // where in the file
     */
    readonly valueFrom: Place;
    /**
     * Its value's parts: the whole value, each part of a composite, each shadow layer or gradient
     * stop, and each length of a dash pattern, every one with where it sits, what it resolved to
     * and the reference written there. `undefined` when its value can't be worked out. An emitter
     * writes each type, and asks of each part's `ref` whether to write a reference to another
     * token instead.
     *
     * @example
     * // a border written { "color": "{color.ink}", "width": { "value": 1, "unit": "px" }, "style": "solid" }
     * const border = token.parts;
     * if (border?.type === "border") {
     *   border.color.ref?.token // color.ink
     *   border.width.resolved   // { value: 1, unit: "px" }
     * }
     */
    readonly parts: Part | undefined;
}

/**
 * A design token. Checking `type` narrows `value` and `resolved` to that type's shape.
 *
 * @example
 * if (token.type === "color") token.resolved?.colorSpace
 */
export type Token = { [T in TokenType]: TokenBase<T> }[TokenType];

/**
 * What a token or group writes itself, beside what applies to it: a group may take its `$type` and
 * `$deprecated` from the group it is inside (Format 6.7.3, 6.3.1), and all four from the group it
 * extends (6.4).
 */
export interface Written {
    readonly type?: TokenType;
    readonly description?: string;
    readonly deprecated?: boolean | string;
    readonly extensions?: Readonly<Record<string, JsonValue>>;
}

/** A group of tokens. */
export interface Group {
    /** Tells a group from a token: an object without `$value` is a group (Format 6.1). */
    readonly kind: "group";
    /** Where the group sits in the tree, such as `"color.brand"`. */
    readonly path: string;
    /**
     * The type its tokens take: its own, else the group it extends, else the group it is inside
     * (Format 6.7.3).
     */
    readonly type?: TokenType;
    /** Its own, else the group it extends. */
    readonly description?: string;
    /** Its own, else the group it extends, else the group it is inside (Format 6.3.1). */
    readonly deprecated?: boolean | string;
    /**
     * The group that writes the `$deprecated` in force, when the group doesn't write its own: the
     * group it extends, else the closest group above it (Format 6.3.1, 6.4). Absent when it writes
     * its own, when the top level of its file writes it, or when none applies.
     */
    readonly deprecatedFrom?: string;
    /** Its own, over those of the group it extends. */
    readonly extensions?: Readonly<Record<string, JsonValue>>;
    /**
     * The group this one takes tokens from, through `$extends` or a `$ref` to another group
     * (Format 6.4), when the reference reaches one. The reference itself is among its
     * {@link Group.references | references}. The tokens it takes are marked
     * {@link TokenBase.inherited | inherited}.
     */
    readonly extends?: Group;
    /**
     * The reference it writes: its `$extends`, or a `$ref` to another group, which reaches a group
     * and so no token. Empty when it writes neither.
     */
    readonly references: readonly Reference[];
    /**
     * Every place a source declares the group, in the order read. Groups can be spread across
     * files, so there may be several, and a group only {@link Group.inherited | inherited} has
     * none.
     */
    readonly writtenAt: readonly Place[];
    /**
     * The place, among {@link Group.writtenAt}, that writes each `$extensions` key the group writes
     * itself. When several files write a key, it is the last one read, whose value for that key is
     * used whole. A key the group takes from the group it extends is left out.
     *
     * @example
     * tokens.spanOf(space.extensionsWrittenAt["com.example"]).file // "space.json"
     */
    readonly extensionsWrittenAt: Readonly<Record<string, Place>>;
    /**
     * Set when the group is here only because of `$extends`, or a `$ref` to another group, at
     * `from`.
     */
    readonly inherited?: { readonly from: string };
    /**
     * What the files write on the group itself, for every property it could also take from
     * elsewhere: all four, since its `$type` and `$deprecated` can come from the group it is
     * inside, and all four from the group it extends. Absent when they write none of it.
     */
    readonly authored?: Written;
    /**
     * Its child tokens and nested groups (Format 6.1), together, in the order the files write
     * them. What a later file adds comes after what the first one wrote, and tokens it takes
     * through `$extends` or a {@link Generator} makes come at the end. Each says its
     * {@link TokenBase.kind | kind}.
     *
     * @example
     * for (const child of dark.group("color")?.children ?? []) show(child.path, child.kind);
     */
    readonly children: readonly (Token | Group)[];
    /** Its root token, the token named `$root` in it (Format 6.2), when it has one. */
    readonly rootToken?: Token;
    /**
     * The tokens directly in it, its child tokens (Format 6.1), in the order
     * {@link Group.children | children} gives them, its root token included.
     *
     * @example
     * dark.group("space")?.childTokens.map(({ path }) => path) // ["space.1", "space.2"]
     */
    readonly childTokens: readonly Token[];
    /**
     * Every token inside it, however deeply nested, in the order the files write them, its root
     * token included. For only the tokens directly in it, see
     * {@link Group.childTokens | childTokens}.
     *
     * @example
     * dark.group("color")?.tokens.map(({ path }) => path)
     */
    readonly tokens: readonly Token[];
}

/**
 * What is written at the top level of a permutation's files: `$type`, `$description`,
 * `$deprecated` and `$extensions`. What sits there is the permutation's
 * {@link Permutation.children | children}. It has no path, since a group may be named `""`
 * (Format 5.1) and so own the empty path.
 */
export interface TopLevel {
    readonly type?: TokenType;
    readonly description?: string;
    readonly deprecated?: boolean | string;
    readonly extensions?: Readonly<Record<string, JsonValue>>;
    /** The top of each file that writes something there. */
    readonly writtenAt: readonly Place[];
}

/**
 * A place a token or group is written: the source that writes it and what it writes there. The
 * same place is the same object in every permutation that reads its source. Where in the file it
 * is, which moves when the text above it changes, is asked of the read:
 * {@link DesignTokens.spanOf}.
 */
export interface Place {
    /**
     * The source that writes it: the file, or part of one, and the set or context it is read
     * through.
     */
    readonly source: Source;
    /**
     * The JSON the file writes there, exactly as written: for a token, its whole object, `$value`,
     * `$type` and the rest, before any reference is followed or anything is taken from a group.
     */
    readonly written: JsonValue;
}

/**
 * A place, as {@link DesignTokens.writtenAt} gives it: written once at `span`, read through each of
 * `sources`. A file several contexts list the same way is one source; listed with different
 * `$extensions` beside its `$ref`, or through different sets, it is a source for each.
 */
export interface PlaceInPermutations {
    readonly span: Span;
    /** Where it is written in its file, as {@link DesignTokens.jsonPathOf} gives it. */
    readonly jsonPath: JsonPath;
    /**
     * The JSON the file writes at `span`, exactly as written, as {@link Place.written} gives it.
     */
    readonly written: JsonValue;
    readonly sources: readonly Source[];
    /** The permutations that read it. */
    readonly readIn: Permutations;
    /**
     * The permutations whose token takes its value from here: those whose
     * {@link TokenBase.valueFrom | valueFrom} it is, since "in case of a conflict, take the most
     * recent occurrence" (Resolver 6.2). None for a token's place that a later source always
     * replaces, and for a group's place, since a group is combined with the others, not replaced.
     *
     * @example
     * const overridden = tokens.writtenAt("color.brand").filter((place) => place.winsIn.length === 0);
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
     * const source = dim.token("color.text")?.valueFrom.source;
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
     * Who reads it: `"everyone"` when a set `resolutionOrder` names reaches it, otherwise each
     * context whose permutations read it. Every context the resolver declares counts, including
     * those whose permutations the read didn't build. For deciding which file an edit belongs in.
     *
     * @example
     * source.readBy // [the context mode: dark]
     */
    readonly readBy: "everyone" | readonly ResolverContext[];
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
    readonly order: readonly ({ readonly set: string } | { readonly modifier: string })[];
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
     * `permutation(input)` takes it.
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
     * const others = tokens.permutations.where((p) => !p.isDefault);
     */
    readonly isDefault: boolean;
    /** What is written at the top level of the files. */
    readonly root: TopLevel;
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
     * {@link Permutation.token | token}.
     */
    readonly tokens: readonly Token[];
    /**
     * Every group, in the same order as {@link Permutation.tokens | tokens}. To find one by path,
     * use {@link Permutation.group | group}.
     */
    readonly groups: readonly Group[];
    /**
     * The token at `path`, or `undefined` when this permutation has none there: no token at all, a
     * group, or one only another permutation has.
     *
     * @example
     * dark.token("color.text")?.resolved
     */
    token(path: string): Token | undefined;
    /**
     * The group at `path`, or `undefined` when this permutation has none there.
     *
     * @example
     * dark.group("color")?.children
     */
    group(path: string): Group | undefined;
    /**
     * Every reference to `path` in this permutation, each with the token or group that writes it in
     * `from`; with `chained`, also every reference to each of those, however indirectly. A group's
     * path covers what is written to it, such as an `$extends`, and to everything inside it.
     *
     * @example
     * dark.referencedBy("color.red").map(({ from }) => from.path) // ["color.brand"]
     * dark.referencedBy("color.red", { chained: true })           // everything a change would reach
     */
    referencedBy(path: string, options?: ReferenceOptions): readonly Reference[];
    /**
     * The references the token or group at `path` writes in this permutation, each with what it
     * references; with `chained`, also those written by each token they name, however indirectly
     * (for a property-level reference, the token holding the property), each once, safe with
     * loops. A group's are its `$extends`, or its `$ref` to another group. Empty for a path that
     * isn't there.
     *
     * @example
     * light.refersTo("color.text").map(({ path }) => path)                   // ["color.brand"]
     * light.refersTo("color.text", { chained: true }).map(({ path }) => path) // ["color.brand", "color.red"]
     */
    refersTo(path: string, options?: ReferenceOptions): readonly Reference[];
    /**
     * Each token or group that refers to `path` in this permutation, once, however many references
     * it writes to it; with `chained`, also each one that refers to those, however indirectly. Wider
     * than the spec's aliases (Format 3.8), tokens whose whole value is another: a composite with one
     * part referring to it, or a group's `$extends`, uses it too.
     *
     * @example
     * dark.usedBy("color.red").map(({ path }) => path) // ["color.brand", "border.danger"]
     */
    usedBy(path: string, options?: ReferenceOptions): readonly (Token | Group)[];
    /**
     * The problems about the token or group at `path` in this permutation: its own, a missing
     * reference it writes, a loop it is part of, a problem in a value it inherits. Those only
     * another permutation has are left out.
     *
     * @example
     * for (const problem of dark.diagnosticsFor("color.brand")) show(problem.message);
     */
    diagnosticsFor(path: string): readonly Diagnostic[];
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
     * `related` where the other is); or an object's `$ref` points at a token, making it one, and it
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
     * `related` is the extension that makes it.
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
         * {@link ReferenceBase.from | from}.
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
 * {@link Diagnostic.docs}.
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
         * const tokens = [diagnostic.path, ...(diagnostic.related ?? []).map((each) => each.path)];
         */
        readonly related?: readonly {
            readonly message: string;
            readonly span: Span;
            readonly path?: string;
        }[];
        /** How an editor may show it: struck through for a deprecated reference. */
        readonly tags?: readonly ("deprecated" | "unnecessary")[];
        /** A page explaining this kind of diagnostic. */
        readonly docs: string;
        readonly detail: DetailByKind[K];
    };
}[keyof DetailByKind];

/**
 * Design tokens as the DTCG specifications define them: every permutation, with every value in one
 * shape and every reference followed. The tokens and groups link down and across, never up: a
 * group's {@link Group.children | children} are the tokens and groups themselves, and a reference's
 * `token` the token it reaches; what is around a token, its group and who refers to it, is asked of
 * its permutation by path. A token or group that is the same in two permutations, written in the
 * same places, taking the same settings from its groups and reaching the same tokens, is one object
 * in both, so `===` tells whether it differs between them. `JSON.stringify` writes their plain
 * form, with a path wherever one links to another, and leaves out what the rest says: a group's
 * `rootToken` and `extends`, `kind`, a reference's `from`, `token` and `targetProperty`, a JSON
 * Pointer's `path`, and where places and references are, which {@link DesignTokens.spanOf} gives.
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
    readonly entry: string;
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
     * order (Resolver 4.1.5.4); to find the default, ask {@link DesignTokens.permutation} with no
     * input. Its label is `"everywhere"`.
     */
    readonly permutations: Permutations;
    /**
     * How the values were read. To read a value from the design tokens again, such as one inside
     * `$extensions`, the same way, give these to `parseValue` or `extensionReader`.
     */
    readonly parseOptions: Required<ParseOptions>;
    /**
     * Every error, warning and note, in the order the read found them; sort by `span` for file
     * order. For those about one token or group,
     * {@link DesignTokens.diagnosticsFor | diagnosticsFor}; for those at a place in a file,
     * {@link DesignTokens.diagnosticsAt | diagnosticsAt}.
     *
     * @example
     * const errors = tokens.diagnostics.filter((d) => d.severity === "error");
     */
    readonly diagnostics: readonly Diagnostic[];
    /**
     * Every reference to `path` written in the files, each once with the permutations it holds
     * in: what renaming `path` rewrites. A group's path covers what is written to it, such as an
     * `$extends`, and to everything inside it. To follow chained references, which go through
     * each permutation's own tokens, ask a permutation ({@link Permutation.referencedBy}).
     *
     * @example
     * for (const { from, span } of tokens.referencedBy("color.brand")) show(from, span);
     */
    referencedBy(path: string): readonly ReferenceInPermutations[];
    /**
     * Every place the token or group at `path` is written, in any permutation, each span once with
     * the sources and permutations that read it and the permutations whose value comes from it, in
     * the order first met: where to edit it, and where a change to its value would show.
     *
     * @example
     * for (const { span } of tokens.writtenAt("color.brand")) rename(span);
     * for (const { span, winsIn } of tokens.writtenAt("color.brand")) row(span.file, winsIn.label);
     */
    writtenAt(path: string): readonly PlaceInPermutations[];
    /**
     * The permutation for an input: modifiers left out take their default (Resolver 4.1.5.3), and
     * names match whatever their case (Resolver 5.1). With no input, the default permutation.
     *
     * @throws {@link PermutationError} when there is none: the input names a modifier or context
     * the resolver does not declare, leaves out a modifier that has no default (Resolver 6.1), or
     * names a permutation the read did not build. Its `detail` says which.
     *
     * @example
     * const dark = tokens.permutation({ mode: "dark" });
     */
    permutation(input?: Input): Permutation;
    /**
     * The token at `path`, when the read has one permutation: a token file, or a resolver with no
     * modifiers. As {@link Permutation.token}, of that permutation. With several, which one is
     * meant has to be said: pick one with {@link DesignTokens.permutation}, or ask every one with
     * {@link everyPermutation}.
     *
     * @throws {@link SeveralPermutationsError} when the read has several permutations.
     *
     * @example
     * const tokens = await read("color.json");
     * tokens.token("color.red")?.resolved
     */
    token(path: string): Token | undefined;
    /**
     * The group at `path`, when the read has one permutation. As {@link Permutation.group}.
     *
     * @throws {@link SeveralPermutationsError} when the read has several permutations.
     */
    group(path: string): Group | undefined;
    /**
     * The tokens and groups that refer to `path`, when the read has one permutation. As
     * {@link Permutation.usedBy}. With several, ask each: whether anything uses it in any
     * permutation is `tokens.permutations.some((p) => p.usedBy(path).length > 0)`.
     *
     * @throws {@link SeveralPermutationsError} when the read has several permutations.
     */
    usedBy(path: string, options?: ReferenceOptions): readonly (Token | Group)[];
    /**
     * The references the value at `path` writes, when the read has one permutation. As
     * {@link Permutation.refersTo}.
     *
     * @throws {@link SeveralPermutationsError} when the read has several permutations.
     */
    refersTo(path: string, options?: ReferenceOptions): readonly Reference[];
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
     * What the top level of the files writes, when the read has one permutation. As
     * {@link Permutation.root}.
     *
     * @throws {@link SeveralPermutationsError} when the read has several permutations.
     */
    readonly root: TopLevel;
    /**
     * A modifier that takes part, by its name, whatever its case (Resolver 5.1), with its contexts
     * and default.
     *
     * @example
     * tokens.modifier("mode")?.contexts.map(({ name }) => name) // ["light", "dark"]
     */
    modifier(name: string): ResolverModifier | undefined;
    /**
     * Every token's path in any permutation, each once, in the order the permutations list them:
     * a token only a later permutation has comes after the earlier ones' tokens.
     *
     * @example
     * for (const path of tokens.tokenPaths()) row(path, dark.token(path)?.resolved);
     */
    tokenPaths(): readonly string[];
    /**
     * Every group's path in any permutation, each once, in the order the permutations list them.
     */
    groupPaths(): readonly string[];
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
     * const lines = tokens.text("dark.json")?.split("\n");
     */
    text(file: string): string | undefined;
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
    toMemory(): TokensInMemory & { readonly entry: string };
    /**
     * What changed since `before`, an earlier read, and in which permutations: tokens and groups
     * added, removed, renamed, or with different properties. A token is compared by what it says,
     * not what it resolves to, so changing one value is one change, not one for every token
     * pointing at it. The value is compared with {@link sameValue}, the type only where the token
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
     * for (const change of tokens.diff(before, { moved })) row(change.kind, change.path);
     */
    diff(before: DesignTokens, options?: { moved?: readonly Move[] }): readonly Change[];
    /**
     * The problems about the token or group at `path`, in every permutation, each with the
     * permutations it is in: its own, a missing reference it writes (reported once however many
     * write it), a loop it is part of, a problem in a value it inherits (reported once, about the
     * token that writes it).
     *
     * @example
     * for (const { message, permutations } of tokens.diagnosticsFor("color.brand")) {
     *   show(message, permutations?.label);
     * }
     */
    diagnosticsFor(path: string): readonly Diagnostic[];
    /**
     * The problems written at a place in a file, or overlapping it: a place of length 0 is a point,
     * such as an editor's cursor.
     *
     * @example
     * const here = tokens.diagnosticsAt({ file: "tokens.json", offset: cursor, length: 0 });
     */
    diagnosticsAt(place: Pick<Span, "file" | "offset" | "length">): readonly Diagnostic[];
    /**
     * Where a place or a reference these design tokens hold is written, in this read's text. A
     * place and a reference hold no position of their own, so one a later read keeps, where its
     * text did not change, is found at its new position by asking that read.
     *
     * @example
     * const { file, offset } = tokens.spanOf(token.valueFrom);
     * goTo(file, tokens.spanOf(token.references[0]).offset);
     */
    spanOf(of: Place | Reference): Span;
    /**
     * Where a place or a reference these design tokens hold is written in its file, as the keys
     * from the top of the file down, part of a file included: what a tool writing the file
     * changes. A root token's place is its `$root`, a token a group inherits is where its value is
     * written in the group it comes from, and a token a {@link Generator} makes, and its
     * reference, are at the extension that makes it. The top of a file is `[]`. Worked out from
     * this read's text when asked, so a read that never asks pays nothing.
     *
     * @throws an `Error` for a place or reference whose position, in this read's text, writes
     * nothing: one from a read of other text.
     *
     * @example
     * tokens.jsonPathOf(text.valueFrom)     // ["color", "text"]
     * tokens.jsonPathOf(text.references[0]) // ["color", "text", "$value"]
     */
    jsonPathOf(of: Place | Reference): JsonPath;
    /**
     * What `file` writes at `jsonPath` in this read's text, exactly as written: the companion of
     * {@link DesignTokens.jsonPathOf}, for a tool writing the file to see what is there now.
     * `undefined` where the file writes nothing, or the read has no such file. Worked out when
     * asked, reading each file's text once for both questions.
     *
     * @example
     * tokens.jsonAt("color.json", ["color", "text", "$value"]) // "{color.brand}"
     */
    jsonAt(file: string, jsonPath: JsonPath): JsonValue | undefined;
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
 * for (const { from, permutations } of tokens.referencedBy("color.red")) {
 *   row(from, permutations.label);   // "mode: dark, sepia", or "everywhere"
 * }
 */
export interface Permutations extends ReadonlyArray<Permutation> {
    /** Each permutation's input, in the same order. */
    readonly inputs: readonly Input[];
    /**
     * Which permutations it holds, by their contexts, for a tool that words them its own way.
     *
     * @example
     * const rest = tokens.permutations.where((each) => !group.includes(each));
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
     * const elsewhere = tokens.permutations.where((each) => each !== edited);
     * elsewhere.label; // "mode: light"
     */
    where(test: (permutation: Permutation) => boolean): Permutations;
    /**
     * The permutation in this list that an input names, found as {@link DesignTokens.permutation}
     * finds it: modifiers left out take their default (Resolver 4.1.5.3), and names match
     * whatever their case (Resolver 5.1); `undefined` when the resolver has no such
     * context or modifier, when the read built no such permutation, or when this list doesn't hold
     * it. What a tool asks to find a permutation again from an input it kept, such as one chosen
     * before the files changed. For why there is none, see {@link completeInput}.
     *
     * @example
     * tokens.permutations.matching({ mode: "dark" })?.label;                          // "mode: dark"
     * tokens.permutations.matching(kept.input) ?? tokens.permutation();               // the default if it went
     * problem.permutations.matching({ mode: "dark" }) !== undefined;                   // found in mode: dark?
     */
    matching(input: Input): Permutation | undefined;
}

/**
 * Why {@link DesignTokens.permutation} found no permutation, with the facts its message is worded
 * from.
 */
export type PermutationErrorDetail = InputProblem | { reason: "not-read"; input: Input };

/**
 * Why a question of one permutation, such as {@link DesignTokens.token}, was asked of design
 * tokens with several, with the facts its message is worded from.
 */
export interface SeveralPermutationsDetail {
    /** What was asked, such as `"token()"` or `"tokens"`. */
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
 * {@link completeInput} gives the first.
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

export { PermutationError, SeveralPermutationsError } from "./lookup/permutation.js";

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
     * color it names, with the string kept as `hex`. Not DTCG 2025.10, which writes every color as
     * an object. Off, a hex string is a `hex-string-color` error; on, one with three or four digits
     * is an `invalid-value` giving the six or eight digits it stands for.
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
     * the read reads values, to read the extension's the same way: give them to `extensionReader`
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
     * same way: give them to `extensionReader` or `parseValue`.
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

export { defineGenerator } from "./read/generate.js";
export { defineExtensionValidator } from "./read/validate-extensions.js";

/**
 * How the design tokens are read: which permutations, the tools that make or check tokens, and how
 * values are read.
 */
export interface ReadOptions extends ParseOptions {
    /**
     * The permutations to build. Modifiers left out take their default; an input that does not
     * fit the resolver is reported and not built.
     * @default the permutations `permutations` asks for
     */
    inputs?: readonly Input[];
    /**
     * Which permutations to build when `inputs` is left out: `"all"`, every combination of
     * contexts, or `"each-context"`, each context on its own, with every other modifier at its
     * default. An input must choose a context for each modifier with no default (Resolver 6.1),
     * so each context is built once for every combination of those modifiers' contexts. When
     * modifiers change different tokens (Resolver 2.1), every combination can be put together
     * from `"each-context"`.
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
 * keeping each text by the name the results use, and {@link filePath} turns it back into `path`.
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

export { read, readFromMemory } from "./read/read.js";

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
    readonly entry?: string | undefined;
}
export { filePath } from "./read/paths.js";

export {
    atOrWithin,
    childPath,
    forbiddenInName,
    movedPath,
    parentOf,
    pathBelow,
    withoutRoot,
} from "./path.js";
export { completeInput } from "./lookup/permutation.js";
export { permutationLabel } from "./lookup/permutation-label.js";
export { everyPermutation } from "./lookup/every-permutation.js";

/**
 * What {@link completeInput} gives: the full input, or the first problem with it.
 */
export type CompleteInput = { ok: true; input: Input } | ({ ok: false } & InputProblem);

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
 * of them, ask it: `dark.token(change.path)`. `changed`, `renamed`, `group-changed` and
 * `group-renamed` list the properties that differ; a rename with nothing else changed lists none.
 * Groups are reported on their own, empty ones included, and so are the tokens inside them. A token
 * a {@link Generator} makes says so (`generated`), with nothing written on either side: its change
 * is the extension's, on its group. One a group takes through `$extends` says so too (`inherited`).
 *
 * @example
 * for (const change of tokens.diff(before)) {
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

export { sameJson, sameValue } from "./values/same-value.js";

/** What is at a position in a file. */
export type AtOffset =
    | { kind: "token"; path: string; expects?: TokenType }
    | { kind: "group"; path: string }
    | { kind: "reference"; from: string; to: string; input: Input; expects?: TokenType }
    | { kind: "nothing" };

/**
 * What is at a position in a file: a token, a group, or a reference, with the type a value there
 * must have. For editors and language servers.
 */
export function atOffset(tokens: DesignTokens, file: string, offset: number): AtOffset {
    throw new Error("not implemented yet");
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

/**
 * Turns a value from the model back into the JSON written in a DTCG file, with references as
 * `"{path}"` and pointers as `{ "$ref": "#/…" }`. Use this before writing a value from the model
 * into a file.
 *
 * @example
 * toDTCGValue("color", { syntax: "curly-brace", path: "color.brand" }) // "{color.brand}"
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

/** How design tokens are written out as DTCG files. */
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
    doc: DesignTokens,
    input?: Input,
    options?: ExportOptions,
): { tokens: JsonObject; skipped: string[] } {
    throw new Error("not implemented yet");
}

/**
 * Writes all the design tokens as a resolver and its files: the default permutation in full,
 * then, for each other context, only what differs.
 */
export function toDTCGProject(
    doc: DesignTokens,
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
