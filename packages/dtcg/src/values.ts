import type { Parse, UnresolvedValue } from "./index.js";
import { readToken } from "./values/read-shape.js";

export { colorSpaces, type ColorComponentRange } from "./values/color-spaces.js";
export { dimensionUnits, durationUnits } from "./values/units.js";
export {
    type FontWeightKeyword,
    type LineCap,
    fontWeightKeywords,
    lineCaps,
    strokeStyleKeywords,
} from "./values/keywords.js";
export { tokenTypes } from "./values/token-types.js";
export { parseValue } from "./values/parse-value.js";
export { isAlias, isPointer, readReference } from "./values/references.js";
export {
    type ExtensionReader,
    type ExtensionResult,
    extensionReader,
} from "./values/extension-reader.js";
export { isJsonObject } from "./values/json.js";
export { compositeParts } from "./values/composite-parts.js";

/**
 * Reads one color value. A reference to a whole token, written `"{color.brand}"`, is read as an
 * `Alias`. A JSON Pointer is read as a `Pointer`, and may stand in place of the whole value or any
 * part of it.
 *
 * @example
 * parseColor({ colorSpace: "srgb", components: [1, 0, 1] }, [])
 * // { ok: true, value: { colorSpace: "srgb", components: [1, 0, 1], alpha: 1 }, ignored: [] }
 *
 * @example
 * parseColor("{color.brand}", [])
 * // { ok: true, value: { alias: "color.brand" }, ignored: [] }
 *
 * @example
 * parseColor({ colorSpace: "srgb", components: [1, 0, 1], name: "magenta" }, [])
 * // { ok: false, errors: [{ kind: "invalid-value", path: ["name"], … }], ignored: [] }
 *
 * @example
 * parseColor({ colorSpace: "srgb", components: [1, 0, 1], name: "magenta" }, [], {
 *   ignoreUnknownProperties: true,
 * })
 * // read without `name`, which is in `ignored`:
 * // [{ kind: "unknown-property", path: ["name"], detail: { type: "color", property: "name" }, … }]
 */
export const parseColor: Parse<UnresolvedValue<"color">> = (raw, at, options) =>
    readToken("color", raw, at, options);
/** Reads one dimension value. */
export const parseDimension: Parse<UnresolvedValue<"dimension">> = (raw, at, options) =>
    readToken("dimension", raw, at, options);
/** Reads one duration value. */
export const parseDuration: Parse<UnresolvedValue<"duration">> = (raw, at, options) =>
    readToken("duration", raw, at, options);
/** Reads one cubic Bézier value. */
export const parseCubicBezier: Parse<UnresolvedValue<"cubicBezier">> = (raw, at, options) =>
    readToken("cubicBezier", raw, at, options);
/** Reads one number value. */
export const parseNumber: Parse<UnresolvedValue<"number">> = (raw, at, options) =>
    readToken("number", raw, at, options);
/** Reads one font family value. A single name becomes a list of one. */
export const parseFontFamily: Parse<UnresolvedValue<"fontFamily">> = (raw, at, options) =>
    readToken("fontFamily", raw, at, options);
/** Reads one font weight value. Keywords become their numbers. */
export const parseFontWeight: Parse<UnresolvedValue<"fontWeight">> = (raw, at, options) =>
    readToken("fontWeight", raw, at, options);
/** Reads one stroke style value. */
export const parseStrokeStyle: Parse<UnresolvedValue<"strokeStyle">> = (raw, at, options) =>
    readToken("strokeStyle", raw, at, options);
/**
 * Reads one border value. A part that is a reference is kept as an `Alias`, and checked
 * against its target when references are followed.
 *
 * @example
 * parseBorder({ color: "{color.brand}", width: { value: 1, unit: "px" }, style: "solid" }, [])
 * // { ok: true, value: { color: { alias: "color.brand" }, width: { value: 1, unit: "px" },
 * //   style: { kind: "keyword", keyword: "solid" } }, ignored: [] }
 */
export const parseBorder: Parse<UnresolvedValue<"border">> = (raw, at, options) =>
    readToken("border", raw, at, options);
/** Reads one shadow value. A single shadow becomes a list of one. */
export const parseShadow: Parse<UnresolvedValue<"shadow">> = (raw, at, options) =>
    readToken("shadow", raw, at, options);
/** Reads one gradient value. */
export const parseGradient: Parse<UnresolvedValue<"gradient">> = (raw, at, options) =>
    readToken("gradient", raw, at, options);
/** Reads one transition value. */
export const parseTransition: Parse<UnresolvedValue<"transition">> = (raw, at, options) =>
    readToken("transition", raw, at, options);
/** Reads one typography value. */
export const parseTypography: Parse<UnresolvedValue<"typography">> = (raw, at, options) =>
    readToken("typography", raw, at, options);
