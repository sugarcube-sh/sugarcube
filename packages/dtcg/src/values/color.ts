import type {
    ColorComponent,
    ColorSpace,
    JsonPath,
    ParseOptions,
    ParseResult,
    Pointer,
    ValueError,
    UnresolvedValue,
} from "../index.js";
import { colorSpaces } from "./color-spaces.js";
import { hexStringColor } from "./hex-color.js";
import { isPlainObject, readAlias, readPointer } from "./references.js";
import { valueError } from "./value-errors.js";

type ColorAsWritten = UnresolvedValue<"color">;
type Component = ColorComponent | Pointer;

const PROPERTIES = new Set(["colorSpace", "components", "alpha", "hex"]);

/**
 * A color written as a hex string, in any of the four forms CSS allows: `#rgb`, `#rgba`, `#rrggbb`
 * or `#rrggbbaa`. A hex string is an error unless `hexStringColors` is on, and then only with six or
 * eight digits. Recognising one lets the error say so, and show how to write the color as an object
 * instead.
 */
const HEX_STRING = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

const READABLE_HEX_STRING = /^#(?:[0-9a-f]{6}|[0-9a-f]{8})$/i;

/**
 * The `hex` fallback on a color object: six-digit CSS hex, such as `"#e11d48"`, as the Color module
 * requires. Either case, since CSS hex is not case-sensitive.
 */
const SIX_DIGIT_HEX = /^#[0-9a-f]{6}$/i;

const type = "color";

export function readColor(
    raw: unknown,
    at: JsonPath,
    options?: ParseOptions,
): ParseResult<ColorAsWritten> {
    const reference = readAlias(raw) ?? readPointer(raw);
    if (reference) return { ok: true, value: reference };

    if (typeof raw === "string" && options?.hexStringColors && READABLE_HEX_STRING.test(raw)) {
        return { ok: true, value: hexStringColor(raw) };
    }
    if (typeof raw === "string" && HEX_STRING.test(raw)) {
        return { ok: false, errors: [valueError(at, { type, reason: "hex-string", value: raw })] };
    }

    if (!isPlainObject(raw)) {
        return { ok: false, errors: [valueError(at, { type, reason: "wrong-shape", value: raw })] };
    }

    const errors: ValueError[] = [];
    for (const name of Object.keys(raw)) {
        if (!PROPERTIES.has(name)) {
            errors.push(
                valueError([...at, name], { type, reason: "unknown-property", property: name }),
            );
        }
    }

    const colorSpace = readColorSpace(raw, at, errors);
    const components = readComponents(raw, at, colorSpace, errors);
    const alpha = readAlpha(raw, at, errors);
    const hex = readHex(raw, at, errors);

    if (errors.length > 0 || colorSpace === undefined || components === undefined) {
        return { ok: false, errors };
    }

    return {
        ok: true,
        value: { colorSpace, components, alpha, ...(hex !== undefined && { hex }) },
    };
}

function readColorSpace(
    raw: Record<string, unknown>,
    at: JsonPath,
    errors: ValueError[],
): ColorSpace | Pointer | undefined {
    if (!("colorSpace" in raw)) {
        errors.push(
            valueError([...at, "colorSpace"], {
                type,
                reason: "missing-property",
                property: "colorSpace",
            }),
        );
        return undefined;
    }

    const pointer = readPointer(raw.colorSpace);
    if (pointer) return pointer;

    if (typeof raw.colorSpace === "string" && Object.hasOwn(colorSpaces, raw.colorSpace)) {
        return raw.colorSpace as ColorSpace;
    }
    errors.push(
        valueError([...at, "colorSpace"], {
            type,
            reason: "unknown-color-space",
            value: raw.colorSpace,
        }),
    );
    return undefined;
}

function readComponents(
    raw: Record<string, unknown>,
    at: JsonPath,
    colorSpace: ColorSpace | Pointer | undefined,
    errors: ValueError[],
): [Component, Component, Component] | Pointer | undefined {
    if (!("components" in raw)) {
        errors.push(
            valueError([...at, "components"], {
                type,
                reason: "missing-property",
                property: "components",
            }),
        );
        return undefined;
    }

    const pointer = readPointer(raw.components);
    if (pointer) return pointer;

    const path = [...at, "components"];
    if (!Array.isArray(raw.components) || raw.components.length !== 3) {
        errors.push(
            valueError(path, { type, reason: "not-three-components", value: raw.components }),
        );
        return undefined;
    }

    const channels = typeof colorSpace === "string" ? colorSpaces[colorSpace] : undefined;
    const before = errors.length;
    const components = raw.components.map((component: unknown, index): Component => {
        const componentPointer = readPointer(component);
        if (componentPointer) return componentPointer;
        if (readAlias(component)) {
            errors.push(
                valueError([...path, index], {
                    type,
                    reason: "alias-not-allowed-here",
                    reference: component as string,
                }),
            );
            return 0;
        }

        if (component === "none") return component;
        if (typeof component !== "number" || !Number.isFinite(component)) {
            errors.push(
                valueError([...path, index], {
                    type,
                    reason: "component-not-a-number",
                    value: component,
                }),
            );
            return 0;
        }

        const channel = channels?.[index];
        if (channel && !inRange(component, channel.min, channel.max, channel.maxExclusive)) {
            errors.push(
                valueError([...path, index], {
                    type,
                    reason: "component-out-of-range",
                    value: component,
                    colorSpace: colorSpace as ColorSpace,
                    component: channel.name,
                    min: channel.min,
                    ...(channel.max !== Infinity && { max: channel.max }),
                    maxExclusive: channel.maxExclusive ?? false,
                }),
            );
        }
        return component;
    });

    if (errors.length > before) return undefined;
    return components as [Component, Component, Component];
}

function readAlpha(
    raw: Record<string, unknown>,
    at: JsonPath,
    errors: ValueError[],
): number | Pointer {
    if (!("alpha" in raw)) return 1;

    const pointer = readPointer(raw.alpha);
    if (pointer) return pointer;

    if (typeof raw.alpha !== "number" || !Number.isFinite(raw.alpha)) {
        errors.push(
            valueError([...at, "alpha"], { type, reason: "not-a-number", value: raw.alpha }),
        );
        return 1;
    }

    if (!inRange(raw.alpha, 0, 1)) {
        errors.push(
            valueError([...at, "alpha"], {
                type,
                reason: "alpha-out-of-range",
                value: raw.alpha,
            }),
        );
    }
    return raw.alpha;
}

function readHex(
    raw: Record<string, unknown>,
    at: JsonPath,
    errors: ValueError[],
): string | Pointer | undefined {
    if (!("hex" in raw)) return undefined;

    const pointer = readPointer(raw.hex);
    if (pointer) return pointer;

    if (typeof raw.hex === "string" && SIX_DIGIT_HEX.test(raw.hex)) return raw.hex;
    errors.push(valueError([...at, "hex"], { type, reason: "hex-not-six-digits", value: raw.hex }));
    return undefined;
}

function inRange(value: number, min: number, max: number, maxExclusive = false): boolean {
    return value >= min && (maxExclusive ? value < max : value <= max);
}
