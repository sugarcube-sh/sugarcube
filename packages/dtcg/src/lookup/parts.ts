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
    switch (token.type) {
        case "strokeStyle":
            return strokeStyle(token, token.resolved, []);
        case "border":
            return {
                type: "border",
                ...base(token, token.resolved, []),
                ...border(token, token.resolved, []),
            };
        case "transition":
            return {
                type: "transition",
                ...base(token, token.resolved, []),
                ...transition(token, token.resolved, []),
            };
        case "shadow":
            return {
                type: "shadow",
                ...base(token, token.resolved, []),
                layers: token.resolved.map((each, index) => layer(token, each, [index])),
            };
        case "gradient":
            return {
                type: "gradient",
                ...base(token, token.resolved, []),
                stops: token.resolved.map((each, index) => stop(token, each, [index])),
            };
        case "typography":
            return {
                type: "typography",
                ...base(token, token.resolved, []),
                ...typography(token, token.resolved, []),
            };
        case "color":
            return simple(token, "color", token.resolved, []);
        case "dimension":
            return simple(token, "dimension", token.resolved, []);
        case "duration":
            return simple(token, "duration", token.resolved, []);
        case "cubicBezier":
            return simple(token, "cubicBezier", token.resolved, []);
        case "number":
            return simple(token, "number", token.resolved, []);
        case "fontFamily":
            return simple(token, "fontFamily", token.resolved, []);
        case "fontWeight":
            return simple(token, "fontWeight", token.resolved, []);
    }
}

function base<V>(token: Token, resolved: V, at: JsonPath): PartBase<V> {
    const ref = referenceAt(token, at);
    return ref ? { at, resolved, ref } : { at, resolved };
}

function simple<T extends SimplePartType>(
    token: Token,
    type: T,
    resolved: ValueByType[T],
    at: JsonPath,
): SimplePart<T> {
    const ref = referenceAt(token, at);
    return ref ? { type, at, resolved, ref } : { type, at, resolved };
}

function strokeStyle(token: Token, resolved: StrokeStyleValue, at: JsonPath): StrokeStylePart {
    return resolved.kind === "keyword"
        ? { type: "strokeStyle", ...base(token, resolved, at) }
        : {
              type: "strokeStyle",
              ...base(token, resolved, at),
              dashArray: resolved.dashArray.map((length, index) =>
                  simple(token, "dimension", length, [...at, "dashArray", index]),
              ),
          };
}

function border(token: Token, { color, width, style }: BorderValue, at: JsonPath) {
    return {
        color: simple(token, "color", color, [...at, "color"]),
        width: simple(token, "dimension", width, [...at, "width"]),
        style: strokeStyle(token, style, [...at, "style"]),
    };
}

function transition(
    token: Token,
    { duration, delay, timingFunction }: TransitionValue,
    at: JsonPath,
) {
    return {
        duration: simple(token, "duration", duration, [...at, "duration"]),
        delay: simple(token, "duration", delay, [...at, "delay"]),
        timingFunction: simple(token, "cubicBezier", timingFunction, [...at, "timingFunction"]),
    };
}

function layer(token: Token, resolved: ShadowLayer, at: JsonPath): ShadowLayerPart {
    return {
        ...base(token, resolved, at),
        color: simple(token, "color", resolved.color, [...at, "color"]),
        offsetX: simple(token, "dimension", resolved.offsetX, [...at, "offsetX"]),
        offsetY: simple(token, "dimension", resolved.offsetY, [...at, "offsetY"]),
        blur: simple(token, "dimension", resolved.blur, [...at, "blur"]),
        spread: simple(token, "dimension", resolved.spread, [...at, "spread"]),
    };
}

function stop(token: Token, resolved: GradientStop, at: JsonPath): GradientStopPart {
    return {
        ...base(token, resolved, at),
        color: simple(token, "color", resolved.color, [...at, "color"]),
        position: simple(token, "number", resolved.position, [...at, "position"]),
    };
}

function typography(token: Token, value: TypographyValue, at: JsonPath) {
    return {
        fontFamily: simple(token, "fontFamily", value.fontFamily, [...at, "fontFamily"]),
        fontSize: simple(token, "dimension", value.fontSize, [...at, "fontSize"]),
        fontWeight: simple(token, "fontWeight", value.fontWeight, [...at, "fontWeight"]),
        letterSpacing: simple(token, "dimension", value.letterSpacing, [...at, "letterSpacing"]),
        lineHeight: simple(token, "number", value.lineHeight, [...at, "lineHeight"]),
    };
}
