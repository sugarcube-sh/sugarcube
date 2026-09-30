import type { ValueErrorCode } from "./values/value-errors.js";

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

/**
 * Replaces every reference in a value, {@link Alias} or {@link Pointer}, with what `replace`
 * returns for it. The rest of the value is kept as it is.
 *
 * @example
 * // a border whose color points at a token you are not emitting a variable for: inline that
 * // one part, keep the rest as var()
 * mapReferences(border.value, (ref) =>
 *   isAlias(ref) && !isInlined(ref.alias) ? `var(--${name(ref.alias)})` : resolveReference(doc, ref))
 */
export function mapReferences<T extends TokenType>(
    value: UnresolvedValue<T>,
    replace: (ref: Alias | Pointer) => unknown,
): unknown {
    throw new Error("not implemented yet");
}

/**
 * Whether a value is a reference to a whole token.
 *
 * @example
 * if (isAlias(token.value)) token.value.alias
 */
export function isAlias(value: unknown): value is Alias {
    throw new Error("not implemented yet");
}

/** Whether a value is a JSON Pointer reference. */
export function isPointer(value: unknown): value is Pointer {
    throw new Error("not implemented yet");
}

/**
 * The value a reference reaches, with every reference inside it followed: the resolved value of
 * the token an {@link Alias} names, or the part a {@link Pointer} points at. `undefined` when it
 * reaches nothing.
 * @param input Which permutation. Defaults to the default permutation.
 */
export function resolveReference(doc: Document, ref: Alias | Pointer, input?: Input): unknown {
    throw new Error("not implemented yet");
}

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
    /** Vendor data from `$extensions`, passed through untouched. */
    extensions?: Record<string, unknown>;
    /**
     * Where the token was read from: which of the permutation's {@link Permutation.sources | sources}
     * it came from, and its place in the file.
     */
    source: { index: number; at: Span };
    /** The value exactly as the file wrote it, and whether the file declared `$type` on this token. Absent for generated tokens. */
    authored?: { value: unknown; typeDeclared: boolean };
    /** Set when a {@link Generator} made the token, from the setting on the group at `by`. */
    generated?: { by: string };
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
    /** Every place the group is declared. Groups can be spread across files, so there may be several. */
    declaredIn: Span[];
}

/**
 * One source of a permutation's tokens: a file, part of one, or tokens written in the resolver.
 * A set in the resolver can have several sources, so the same set can appear on several.
 */
export interface Source {
    file: string;
    /** Set when the source is only part of the file, such as `"#/color"`. */
    pointer?: string;
    /**
     * How the resolver reached it: straight from a set, or through a modifier's context, possibly
     * by way of a set that context names. Absent when there is no resolver.
     */
    from?: { set: string } | { modifier: string; context: string; set?: string };
    /** Vendor data from the `$extensions` of the set that lists it, passed through untouched. */
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
    /** Every token, keyed by path, in the order the files list them. Invalid tokens are included. */
    tokens: Record<string, Token>;
    /** Every group, keyed by path, in the order the files list them. */
    groups: Record<string, Group>;
}

/** One reference from one token to another, in one permutation. */
export interface Edge {
    from: string;
    /** The token referred to. For a {@link Pointer} into part of a value, the token holding that part. */
    to: string;
    /** Index into {@link Document.permutations}. */
    permutation: number;
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
        modifier: string;
        context?: string;
        /** The contexts the modifier does allow. */
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
        property: "$type" | "$description" | "$deprecated" | "$extensions";
        expected: "string" | "object" | "boolean-or-string";
    };
    /** No type can be worked out for a token. */
    "missing-type": Record<string, never>;
    /** A `$type` is not one of the thirteen the specification defines (Format 8). */
    "unknown-type": { type: string };
    /** A value does not fit its type. */
    "invalid-value": {
        type: TokenType;
        at: JsonPath;
        /** Why, as the parser named it: see {@link ValueError.detail}. */
        reason?: ValueErrorCode;
    };
    /** A color written as a hex string, which the 2025.10 Color module no longer allows. */
    "hex-string-color": { value: string };
    /** An `$extensions` entry fails a registered check. */
    "extension-invalid": { key: string };
    /** A reference points at a token that does not exist. */
    "missing-reference": {
        ref: string;
        /** Every token that refers to it. */
        referencedBy: string[];
    };
    /** References that lead back to where they started. */
    "circular-reference": { chain: string[] };
    /** A reference points at a token of the wrong type. */
    "type-mismatch": { ref: string; expected: TokenType; found: TokenType };
    /** A name starts or ends with a space: legal, but almost always a typo. */
    "whitespace-in-name": { name: string };
    /** A token the file declares takes the place of one a generator would have made. */
    "generator-overridden": { generator: string; group: string; name: string };
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
    | "invalid-default";

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
export type Diagnostic = {
    [K in DiagnosticKind]: {
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
        detail: DiagnosticDetailByKind[K];
    };
}[DiagnosticKind];

/** The diagnostics that stop a design system from being used: those with severity `"error"`. */
export function errors(doc: Document): Diagnostic[] {
    throw new Error("not implemented yet");
}

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
    /** Every reference between tokens, per permutation. */
    graph: Edge[];
    /** Every error, warning and note, in file order. {@link errors} picks out the errors. */
    diagnostics: Diagnostic[];
}

/**
 * Why a value could not be read, as a stable name to switch on, such as `"unit-not-allowed"`. An
 * {@link ExtensionValidator} may use names of its own.
 */
export type { ValueErrorCode } from "./values/value-errors.js";

/** Why a single value could not be read. */
export interface ValueError {
    kind: "invalid-value";
    /** Where in the value the problem is, such as `["color"]` inside a shadow. */
    path: JsonPath;
    message: string;
    /** Why, as a stable name, so a tool can tell the cases apart without parsing `message`. */
    detail?: ValueErrorCode | (string & {});
}

/** The outcome of reading one value. */
export type ParseResult<V> = { ok: true; value: V } | { ok: false; errors: ValueError[] };

/** Reads one raw value into its shape, or explains why it cannot. */
export type Parse<V> = (raw: unknown, at: JsonPath) => ParseResult<V>;

/** A check for your own `$extensions` key. The data is kept either way; this only adds errors. */
export interface ExtensionValidator {
    /** The vendor namespace, such as `"com.example"`. */
    key: string;
    appliesTo: (TokenType | "group")[];
    validate: (raw: unknown, at: JsonPath) => ValueError[];
}

/** A token a generator makes, written as it would be in a file. */
export interface GeneratedToken {
    /** @default the group's type */
    $type?: TokenType;
    $value: unknown;
    $description?: string;
    $extensions?: Record<string, unknown>;
}

/**
 * Makes tokens from a setting on a group, such as a scale recipe. The reader finds the groups,
 * marks what is made as {@link TokenBase.generated | generated}, reads it like any written token,
 * and lets a token the file already declares win, with a warning naming both.
 */
export interface Generator<S = unknown> {
    /** Picks this generator's setting out of a group's `$extensions`. `undefined` means it does not apply. */
    select: (extensions: Record<string, unknown>) => S | undefined;
    /** The tokens to make in the group, keyed by name. */
    generate: (
        group: { path: string; type?: TokenType },
        setting: S,
        api: { warn: (message: string) => void },
    ) => Record<string, GeneratedToken>;
}

/**
 * Defines a {@link Generator}.
 *
 * @example
 * // { "space": { "$type": "dimension", "$extensions": { "com.example": { "steps": 4 } } } }
 * const scale = defineGenerator({
 *   select: (extensions) => (extensions["com.example"] as { steps?: number } | undefined)?.steps,
 *   generate: (group, steps) =>
 *     Object.fromEntries(
 *       Array.from({ length: steps }, (_, i) => [`${i + 1}`, { $value: { value: i + 1, unit: "rem" } }]),
 *     ),
 * });
 */
export function defineGenerator<S>(generator: Generator<S>): Generator<S> {
    throw new Error("not implemented yet");
}

export interface ReadOptions {
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
     * `permutation-limit` warning says so.
     * @default 64
     */
    permutationLimit?: number;
    /** Checks for your own `$extensions` keys. */
    extensionValidators?: ExtensionValidator[];
    /** Tokens made from settings on groups, such as recipes. Run in order, before values are read. */
    generators?: Generator<any>[];
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
    type: TokenType;
    /** The token in each permutation that has it, keyed by {@link Permutation.label | label}. */
    permutations: Record<string, Token>;
    /** The token in the default permutation. */
    default?: Token;
}

/**
 * Every token, each with its value in every permutation.
 *
 * @example
 * byToken(doc)["color.brand"].permutations.dark?.resolved
 */
export function byToken(doc: Document): Record<string, TokenView> {
    throw new Error("not implemented yet");
}

/** The permutation in which every modifier is at its default, if there is one. */
export function defaultPermutation(doc: Document): Permutation | undefined {
    throw new Error("not implemented yet");
}

/** The permutation for an input. */
export function permutation(doc: Document, input?: Input): Permutation | undefined {
    throw new Error("not implemented yet");
}

/**
 * A token by path.
 * @param input Which permutation. Defaults to the default permutation.
 */
export function token(doc: Document, path: string, input?: Input): Token | undefined {
    throw new Error("not implemented yet");
}

/**
 * The group at a path.
 * @param input Which permutation. Defaults to the default permutation.
 */
export function group(doc: Document, path: string, input?: Input): Group | undefined {
    throw new Error("not implemented yet");
}

/**
 * The tokens in a group, and in its subgroups, in file order. The group's own `$root` token is
 * included; a sibling whose name merely starts the same way is not.
 * @param input Which permutation. Defaults to the default permutation.
 *
 * @example
 * tokensIn(doc, "space")   // space.xs, space.sm, … but not spacer.x
 */
export function tokensIn(doc: Document, path: string, input?: Input): Token[] {
    throw new Error("not implemented yet");
}

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
 * the setting on its group and fold the steps under it.
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

/**
 * The tokens that refer to this one.
 * @param input Only this permutation. Left out: every permutation, each result saying where it holds.
 *
 * @example
 * referrers(doc, "palette.red.600")                     // everywhere
 * referrers(doc, "palette.red.600", { theme: "dark" })  // in dark only
 */
export function referrers(
    doc: Document,
    path: string,
    input?: Input,
    options?: {
        /**
         * Include tokens that refer to it through others, however indirectly. Safe with cycles.
         * @default false
         */
        transitive?: boolean;
    },
): Related[] {
    throw new Error("not implemented yet");
}

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
