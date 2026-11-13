import type { JsonPath } from "./location.js";
import type { Reference } from "./reference.js";
import type {
    BorderValue,
    GradientStop,
    GradientValue,
    ShadowLayer,
    ShadowValue,
    StrokeStyleKeyword,
    StrokeStyleValue,
    TransitionValue,
    TypographyValue,
    ValueByType,
} from "./value.js";

/**
 * One part of a token's value.
 *
 * It can be the whole value, or a part of it, such as a border's `color` or one shadow layer.
 * Check `type`, and TypeScript knows its `resolved` and its own parts.
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
    | (PartBase<StrokeStyleKeyword> & {
          readonly type: "strokeStyle";
      })
    | (PartBase<Exclude<StrokeStyleValue, string>> & {
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
