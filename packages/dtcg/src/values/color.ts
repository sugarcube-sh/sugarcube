import type { ColorSpace } from "../index.js";
import { colorSpaces } from "./color-spaces.js";
import { expandedHex, hexStringAsObject, hexStringColor } from "./hex-color.js";
import {
    type Siblings,
    type Syntax,
    dependsOn,
    literal,
    no,
    object,
    ok,
    oneOf,
    optional,
    refuse,
    tuple,
    withDefault,
    wrongShape,
} from "./syntax.js";

/**
 * A color written as a hex string, in any of the four forms CSS allows: `#rgb`, `#rgba`, `#rrggbb`
 * or `#rrggbbaa`. A hex string is an error unless `hexStringColors` is on, and then only with six or
 * eight digits. Recognising one lets the error say so: with the option off, how to write the color
 * as an object; with it on, the six or eight digits a short one stands for.
 */
const HEX_STRING = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

const READABLE_HEX_STRING = /^#(?:[0-9a-f]{6}|[0-9a-f]{8})$/i;

/**
 * The `hex` fallback on a color object: six-digit CSS hex, such as `"#e11d48"`, as the Color module
 * requires. Either case, since CSS hex is not case-sensitive.
 */
const SIX_DIGIT_HEX = /^#[0-9a-f]{6}$/i;

const hexString = literal((raw, options) => {
    if (typeof raw === "string" && options.hexStringColors && READABLE_HEX_STRING.test(raw)) {
        return ok(hexStringColor(raw));
    }
    if (typeof raw === "string" && HEX_STRING.test(raw)) {
        if (options.hexStringColors) {
            return no({ reason: "short-hex-string", value: raw, expanded: expandedHex(raw) });
        }
        return no({ reason: "hex-string", value: raw, asObject: hexStringAsObject(raw) });
    }
    return no(wrongShape(raw));
});

const colorSpace = literal((raw) =>
    isColorSpace(raw) ? ok(raw) : no({ reason: "unknown-color-space", value: raw }),
);

function component(space: ColorSpace | undefined, index: 0 | 1 | 2) {
    const channel = space && colorSpaces[space][index];
    return literal((raw) => {
        if (raw === "none") return ok(raw);
        if (typeof raw !== "number" || !Number.isFinite(raw)) {
            return no({ reason: "component-not-a-number", value: raw });
        }
        if (channel && space && !inRange(raw, channel.min, channel.max, channel.maxExclusive)) {
            return no({
                reason: "component-out-of-range",
                value: raw,
                colorSpace: space,
                component: channel.name,
                min: channel.min,
                ...(channel.max !== Infinity && { max: channel.max }),
                maxExclusive: channel.maxExclusive ?? false,
            });
        }
        return ok(raw);
    });
}

const notThree = refuse("not-three-components");

function components(space: ColorSpace | undefined) {
    const items = [component(space, 0), component(space, 1), component(space, 2)];
    return oneOf({ array: tuple(items, notThree), other: notThree });
}

const alpha = literal((raw) => {
    if (typeof raw !== "number" || !Number.isFinite(raw)) {
        return no({ reason: "not-a-number", value: raw });
    }
    return inRange(raw, 0, 1) ? ok(raw) : no({ reason: "alpha-out-of-range", value: raw });
});

const THREE_DIGIT_HEX = /^#[0-9a-f]{3}$/i;

const hex = literal((raw) => {
    if (typeof raw === "string" && SIX_DIGIT_HEX.test(raw)) return ok(raw);
    if (typeof raw !== "string" || !THREE_DIGIT_HEX.test(raw)) {
        return no({ reason: "hex-not-six-digits", value: raw });
    }
    return no({ reason: "hex-not-six-digits", value: raw, sixDigits: expandedHex(raw) });
});

export const color = oneOf({
    string: hexString,
    object: object({
        colorSpace,
        components: dependsOn(componentsFor),
        alpha: withDefault(alpha, 1),
        hex: optional(hex),
    }),
    other: wrongShape,
});

function componentsFor({ colorSpace: space }: Siblings): Syntax {
    return components(isColorSpace(space) ? space : undefined);
}

function isColorSpace(value: unknown): value is ColorSpace {
    return typeof value === "string" && Object.hasOwn(colorSpaces, value);
}

function inRange(value: number, min: number, max: number, maxExclusive = false): boolean {
    return value >= min && (maxExclusive ? value < max : value <= max);
}
