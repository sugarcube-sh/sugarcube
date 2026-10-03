import type {
    BorderValue,
    GradientStop,
    GradientStopPart,
    JsonPath,
    Part,
    PartBase,
    ShadowLayer,
    ShadowLayerPart,
    SimplePart,
    SimplePartType,
    StrokeStylePart,
    StrokeStyleValue,
    Token,
    TransitionValue,
    TypographyValue,
    ValueByType,
} from "../index.js";
import { referenceAt } from "./references.js";

/**
 * A token's value as its parts: the whole value, and within it each part of a composite, each
 * shadow layer or gradient stop, and each length of a dash pattern, every one with where it sits,
 * what it resolved to and the reference written there. `undefined` for a token with no resolved
 * value. An emitter writes each type, and asks of each part's `ref` whether to write a reference
 * to another token instead.
 *
 * @example
 * // a border written { "color": "{color.ink}", "width": { "value": 1, "unit": "px" }, "style": "solid" }
 * const border = parts(token);
 * if (border?.type === "border") {
 *   border.color.ref        // { alias: "color.ink" }
 *   border.width.resolved   // { value: 1, unit: "px" }
 * }
 */
export function parts(token: Token): Part | undefined {
    if (token.resolved === undefined) return undefined;
    const base = <V>(resolved: V, at: JsonPath): PartBase<V> => {
        const ref = referenceAt(token, at);
        return ref ? { at, resolved, ref } : { at, resolved };
    };
    const simple = <T extends SimplePartType>(
        type: T,
        resolved: ValueByType[T],
        at: JsonPath,
    ): SimplePart<T> => ({ type, ...base(resolved, at) });
    const strokeStyle = (resolved: StrokeStyleValue, at: JsonPath): StrokeStylePart =>
        resolved.kind === "keyword"
            ? { type: "strokeStyle", ...base(resolved, at) }
            : {
                  type: "strokeStyle",
                  ...base(resolved, at),
                  dashArray: resolved.dashArray.map((length, index) =>
                      simple("dimension", length, [...at, "dashArray", index]),
                  ),
              };
    const border = ({ color, width, style }: BorderValue, at: JsonPath) => ({
        color: simple("color", color, [...at, "color"]),
        width: simple("dimension", width, [...at, "width"]),
        style: strokeStyle(style, [...at, "style"]),
    });
    const transition = ({ duration, delay, timingFunction }: TransitionValue, at: JsonPath) => ({
        duration: simple("duration", duration, [...at, "duration"]),
        delay: simple("duration", delay, [...at, "delay"]),
        timingFunction: simple("cubicBezier", timingFunction, [...at, "timingFunction"]),
    });
    const layer = (resolved: ShadowLayer, at: JsonPath): ShadowLayerPart => ({
        ...base(resolved, at),
        color: simple("color", resolved.color, [...at, "color"]),
        offsetX: simple("dimension", resolved.offsetX, [...at, "offsetX"]),
        offsetY: simple("dimension", resolved.offsetY, [...at, "offsetY"]),
        blur: simple("dimension", resolved.blur, [...at, "blur"]),
        spread: simple("dimension", resolved.spread, [...at, "spread"]),
    });
    const stop = (resolved: GradientStop, at: JsonPath): GradientStopPart => ({
        ...base(resolved, at),
        color: simple("color", resolved.color, [...at, "color"]),
        position: simple("number", resolved.position, [...at, "position"]),
    });
    const typography = (value: TypographyValue, at: JsonPath) => ({
        fontFamily: simple("fontFamily", value.fontFamily, [...at, "fontFamily"]),
        fontSize: simple("dimension", value.fontSize, [...at, "fontSize"]),
        fontWeight: simple("fontWeight", value.fontWeight, [...at, "fontWeight"]),
        letterSpacing: simple("dimension", value.letterSpacing, [...at, "letterSpacing"]),
        lineHeight: simple("number", value.lineHeight, [...at, "lineHeight"]),
    });

    switch (token.type) {
        case "strokeStyle":
            return strokeStyle(token.resolved, []);
        case "border":
            return { type: "border", ...base(token.resolved, []), ...border(token.resolved, []) };
        case "transition":
            return {
                type: "transition",
                ...base(token.resolved, []),
                ...transition(token.resolved, []),
            };
        case "shadow":
            return {
                type: "shadow",
                ...base(token.resolved, []),
                layers: token.resolved.map((each, index) => layer(each, [index])),
            };
        case "gradient":
            return {
                type: "gradient",
                ...base(token.resolved, []),
                stops: token.resolved.map((each, index) => stop(each, [index])),
            };
        case "typography":
            return {
                type: "typography",
                ...base(token.resolved, []),
                ...typography(token.resolved, []),
            };
        case "color":
            return simple("color", token.resolved, []);
        case "dimension":
            return simple("dimension", token.resolved, []);
        case "duration":
            return simple("duration", token.resolved, []);
        case "cubicBezier":
            return simple("cubicBezier", token.resolved, []);
        case "number":
            return simple("number", token.resolved, []);
        case "fontFamily":
            return simple("fontFamily", token.resolved, []);
        case "fontWeight":
            return simple("fontWeight", token.resolved, []);
    }
}
