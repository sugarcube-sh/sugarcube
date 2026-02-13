// DTCG (Design Tokens Community Group) Format Types
// See: https://design-tokens.github.io/community-group/format/

type TokenValue<T extends TokenType> = RawTokenValue<T> | Reference<T>;

type RawTokenValue<T extends TokenType> = T extends SimpleTokenType
    ? SimpleTokenValue<T>
    : T extends CompositeTokenType
      ? CompositeTokenValue<T>
      : never;

/** Reference to another token. String format: "{path.to.token}". */
type Reference<T extends TokenType = TokenType> = string & {
    __tokenType?: T;
};

type NodeMetadata = {
    $description?: string;
    $extensions?: { [key: string]: unknown };
};

type Token = NodeMetadata & {
    $value: TokenValue<TokenType>;
    $type?: TokenType;
};

type TokenGroup = NodeMetadata & {
    $type?: TokenType;
    [key: string]: Token | TokenGroup | TokenType | undefined;
};

type DesignTokens = TokenGroup;

// Simple Token Types

type TokenType = SimpleTokenType | CompositeTokenType;

type SimpleTokenType =
    | "color"
    | "dimension"
    | "fluidDimension"
    | "duration"
    | "cubicBezier"
    | "fontFamily"
    | "fontWeight"
    | "number";

type SimpleTokenValue<T extends SimpleTokenType = SimpleTokenType> = T extends "color"
    ? Color
    : T extends "dimension"
      ? Dimension
      : T extends "fluidDimension"
        ? FluidDimension
        : T extends "duration"
          ? Duration
          : T extends "cubicBezier"
            ? CubicBezier
            : T extends "fontFamily"
              ? FontFamily
              : T extends "fontWeight"
                ? FontWeight
                : T extends "number"
                  ? number
                  : never;

// Composite Token Types

type CompositeTokenType =
    | AlwaysDecomposedType
    | "border"
    | "shadow"
    | "gradient"
    | "transition"
    | StructuralCompositeType;

/** Types that decompose into multiple CSS properties (e.g., typography → font-family, font-size, etc.). */
type AlwaysDecomposedType = "typography";

type StructuralCompositeType = "strokeStyle";

type CompositeTokenValue<T extends CompositeTokenType = CompositeTokenType> = T extends "typography"
    ? Typography
    : T extends "border"
      ? Border
      : T extends "shadow"
        ? Shadow
        : T extends "gradient"
          ? Gradient
          : T extends "transition"
            ? Transition
            : T extends "strokeStyle"
              ? StrokeStyle
              : never;

// Value Types

/** CSS color string or W3C color object with colorSpace. */
type Color =
    | string
    | {
          colorSpace: "oklch" | "display-p3";
          components: [number, number, number];
          alpha?: number;
          hex?: string;
      };

type Dimension = {
    value: number;
    unit: "px" | "rem";
};

/** Responsive dimension that scales between viewport sizes. */
type FluidDimension = {
    min: Dimension;
    max: Dimension;
};

type Duration = {
    value: number;
    unit: "ms" | "s";
};

/** Bezier curve control points: [x1, y1, x2, y2]. */
type CubicBezier = [number, number, number, number];

type FontFamily = string | string[];

type FontWeight = number | FontWeightString;

type FontWeightString =
    | "thin"
    | "hairline"
    | "extra-light"
    | "ultra-light"
    | "light"
    | "normal"
    | "regular"
    | "book"
    | "medium"
    | "semi-bold"
    | "demi-bold"
    | "bold"
    | "extra-bold"
    | "ultra-bold"
    | "black"
    | "heavy"
    | "extra-black"
    | "ultra-black";

type LineCap = "round" | "butt" | "square";

// Composite Value Types

type Typography = {
    fontFamily: TokenValue<"fontFamily">;
    fontSize: TokenValue<"dimension">;
    fontWeight?: TokenValue<"fontWeight">;
    letterSpacing?: TokenValue<"dimension">;
    lineHeight?: TokenValue<"number">;
};

type Transition = {
    duration: TokenValue<"duration">;
    delay?: TokenValue<"duration">;
    timingFunction: TokenValue<"cubicBezier">;
};

type StrokeStyleKeyword =
    | "solid"
    | "dashed"
    | "dotted"
    | "double"
    | "groove"
    | "ridge"
    | "outset"
    | "inset";

type StrokeStyleCustom = {
    dashArray: Array<TokenValue<"dimension">>;
    lineCap: LineCap;
};

type StrokeStyle = StrokeStyleKeyword | StrokeStyleCustom;

type Border = {
    color: TokenValue<"color">;
    width: TokenValue<"dimension">;
    style: StrokeStyle | Reference<"strokeStyle">;
};

type ShadowObject = {
    color: TokenValue<"color">;
    offsetX: TokenValue<"dimension">;
    offsetY: TokenValue<"dimension">;
    blur: TokenValue<"dimension">;
    spread: TokenValue<"dimension">;
    inset?: boolean;
};

type Shadow = ShadowObject | ShadowObject[];

type GradientStop = {
    color: TokenValue<"color">;
    position: number | Reference<"number">;
};

type Gradient = GradientStop[];

export type {
    Token,
    NodeMetadata,
    TokenGroup,
    TokenType,
    SimpleTokenType,
    AlwaysDecomposedType,
    StructuralCompositeType,
    TokenValue,
    RawTokenValue,
    Dimension,
    FluidDimension,
    Duration,
    FontFamily,
    LineCap,
    StrokeStyleKeyword,
    ShadowObject,
    Reference,
};
