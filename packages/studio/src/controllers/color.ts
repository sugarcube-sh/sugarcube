import type {
    ColorComponent,
    ColorSpace,
    ColorValue,
    JsonObject,
    JsonValue,
} from "@sugarcube-sh/dtcg";
import { colorSpaces, isJsonObject, parseValue } from "@sugarcube-sh/dtcg/values";
import { writtenColor } from "./written-color";
import { type Color, type Mode, converter, formatCss, formatHex, toGamut } from "culori";
import { numberIn } from "./typed-text";

type Components = readonly [ColorComponent, ColorComponent, ColorComponent];

export type ColorField =
    | { readonly kind: "color"; readonly written: string; readonly color: Color }
    | {
          readonly kind: "color";
          readonly written: JsonObject;
          readonly color: Color;
          readonly space: Space;
          readonly components: Components;
      };

export type ColorDraft =
    | {
          readonly kind: "color";
          readonly colorSpace: string;
          readonly components: readonly [string, string, string];
          readonly alpha: string;
          readonly was?: JsonObject;
      }
    | { readonly kind: "hexColor"; readonly hex: string };

export interface Channel {
    readonly name: string;
    readonly min: number;
    readonly max: number;
    readonly step: number;
}

interface Gamut {
    readonly name: string;
    readonly mode: Mode;
}

interface Space {
    readonly name: ColorSpace;
    readonly mode: Mode;
    readonly channels: readonly [string, string, string];
    readonly scale: readonly [number, number, number];
    readonly gamut?: Gamut;
}

const sRGB: Gamut = { name: "sRGB", mode: "rgb" };
const displayP3: Gamut = { name: "Display P3", mode: "p3" };
const rec2020: Gamut = { name: "Rec. 2020", mode: "rec2020" };
const gamuts: readonly Gamut[] = [sRGB, displayP3, rec2020];

const eightBitStep = 1 / 255;

const rgb = ["r", "g", "b"] as const;
const same = [1, 1, 1] as const;

const inCuloriTerms = {
    "srgb": { mode: "rgb", channels: rgb, scale: same, gamut: sRGB },
    "srgb-linear": { mode: "lrgb", channels: rgb, scale: same, gamut: sRGB },
    "hsl": { mode: "hsl", channels: ["h", "s", "l"], scale: [1, 100, 100], gamut: sRGB },
    "hwb": { mode: "hwb", channels: ["h", "w", "b"], scale: [1, 100, 100], gamut: sRGB },
    "lab": { mode: "lab", channels: ["l", "a", "b"], scale: same },
    "lch": { mode: "lch", channels: ["l", "c", "h"], scale: same },
    "oklab": { mode: "oklab", channels: ["l", "a", "b"], scale: same },
    "oklch": { mode: "oklch", channels: ["l", "c", "h"], scale: same },
    "display-p3": { mode: "p3", channels: rgb, scale: same, gamut: displayP3 },
    "a98-rgb": { mode: "a98", channels: rgb, scale: same, gamut: { name: "A98 RGB", mode: "a98" } },
    "prophoto-rgb": {
        mode: "prophoto",
        channels: rgb,
        scale: same,
        gamut: { name: "ProPhoto RGB", mode: "prophoto" },
    },
    "rec2020": { mode: "rec2020", channels: rgb, scale: same, gamut: rec2020 },
    "xyz-d65": { mode: "xyz65", channels: ["x", "y", "z"], scale: same },
    "xyz-d50": { mode: "xyz50", channels: ["x", "y", "z"], scale: same },
} as const satisfies Record<ColorSpace, Omit<Space, "name">>;

export const spaceNames = Object.keys(colorSpaces) as ColorSpace[];

export function colorField(written: JsonValue): ColorField | undefined {
    const read = parseValue("color", written, { references: false, hexStringColors: true });
    if (!read.ok) return undefined;
    if (typeof written === "string") {
        return { kind: "color", written, color: inCulori(spaceOf("srgb"), read.value) };
    }
    const space = spaceNamed(read.value.colorSpace);
    return space && isJsonObject(written)
        ? {
              kind: "color",
              written,
              color: inCulori(space, read.value),
              space,
              components: read.value.components,
          }
        : undefined;
}

export function colorDraft(field: ColorField | undefined): ColorDraft {
    if (!field) {
        return { kind: "color", colorSpace: "", components: ["", "", ""], alpha: "" };
    }
    if (!("space" in field)) return { kind: "hexColor", hex: field.written };
    const [a, b, c] = field.components;
    const { alpha } = field.written;
    return {
        kind: "color",
        colorSpace: field.space.name,
        components: [String(a), String(b), String(c)],
        alpha: typeof alpha === "number" ? String(alpha) : "",
        was: field.written,
    };
}

export function colorFrom(draft: ColorDraft): ColorField | undefined {
    if (draft.kind === "hexColor") return colorField(draft.hex);
    const space = spaceNamed(draft.colorSpace);
    const [a, b, c] = draft.components.map(componentIn);
    const alpha = draft.alpha.trim() === "" ? undefined : numberIn(draft.alpha);
    if (!space || a === undefined || b === undefined || c === undefined) return undefined;
    if (draft.alpha.trim() !== "" && alpha === undefined) return undefined;
    const opaque = alpha === undefined && draft.was && "alpha" in draft.was ? 1 : alpha;
    const components: Components = [a, b, c];
    const color = inCulori(space, { components, alpha: opaque ?? 1 });
    const written: JsonObject = {
        ...draft.was,
        colorSpace: space.name,
        components,
        ...(opaque !== undefined && { alpha: opaque }),
        ...(draft.was && "hex" in draft.was && { hex: formatHex(color) }),
    };
    return { kind: "color", written, color, space, components };
}

export function withComponent(
    draft: Extract<ColorDraft, { kind: "color" }>,
    index: number,
    text: string,
): Extract<ColorDraft, { kind: "color" }> {
    const [a, b, c] = draft.components;
    const at = (here: number, was: string) => (here === index ? text : was);
    return { ...draft, components: [at(0, a), at(1, b), at(2, c)] };
}

export function inSpace(
    draft: Extract<ColorDraft, { kind: "color" }>,
    name: string,
    last?: ColorField,
): { draft: Extract<ColorDraft, { kind: "color" }>; fitted?: string } {
    const from = colorFrom(draft) ?? last;
    const space = spaceNamed(name);
    if (!from || !space) return { draft: { ...draft, colorSpace: name }, fitted: undefined };
    const { gamut } = space;
    const fitted = gamut && !fits(from.color, gamut) ? gamut : undefined;
    const color = fitted ? toGamut(fitted.mode, "oklch")(from.color) : from.color;
    const converted = new Map<string, unknown>(Object.entries(converter(space.mode)(color)));
    const ranges = colorSpaces[space.name];
    const [a, b, c] = space.channels.map((channel, index) => {
        const component = converted.get(channel);
        if (typeof component !== "number") return undefined;
        const scaled = component * (space.scale[index] ?? 1);
        const range = ranges[index];
        return gamut && range && !range.maxExclusive
            ? Math.min(range.max, Math.max(range.min, scaled))
            : scaled;
    });
    const [x, y, z] = writtenColor({ colorSpace: space.name, components: [a, b, c] }).components;
    return {
        draft: { ...draft, colorSpace: space.name, components: [String(x), String(y), String(z)] },
        fitted: fitted?.name,
    };
}

export function gamutOf(field: ColorField): string | undefined {
    return gamuts.find((gamut) => fits(field.color, gamut))?.name;
}

export function channelsOf(name: string): Channel[] {
    const space = spaceNamed(name);
    return space
        ? colorSpaces[space.name].map((channel) => {
              const { min, max } = channel.inPractice ?? channel;
              const step = max - min > 1 ? 0.1 : 0.001;
              const top = channel.maxExclusive ? max - step : max;
              return { name: channel.name, min, max: top, step };
          })
        : [];
}

export function colorCss(field: ColorField): string {
    return typeof field.written === "string" ? field.written : formatCss(field.color);
}

export function trackOf(field: ColorField, index: number): string {
    const channel = "space" in field ? channelsOf(field.space.name)[index] : undefined;
    if (!("space" in field) || !channel) return "none";
    const stops = Array.from({ length: 7 }, (_, step) => {
        const value = channel.min + ((channel.max - channel.min) * step) / 6;
        const [a, b, c] = field.components.map((each, at) => (at === index ? value : each));
        const color = inCulori(field.space, {
            components: [a ?? "none", b ?? "none", c ?? "none"],
            alpha: field.color.alpha ?? 1,
        });
        return formatCss(color);
    });
    return `linear-gradient(to right, ${stops.join(", ")})`;
}

function inCulori(space: Space, value: Pick<ColorValue, "components" | "alpha">): Color {
    const color: Record<string, unknown> = { mode: space.mode, alpha: value.alpha };
    space.channels.forEach((channel, index) => {
        const component = value.components[index];
        if (typeof component === "number") color[channel] = component / (space.scale[index] ?? 1);
    });
    return color as unknown as Color;
}

function fits(color: Color, gamut: Gamut): boolean {
    const channels = Object.entries(converter(gamut.mode)(color));
    return channels.every(
        ([key, value]) =>
            !["r", "g", "b"].includes(key) ||
            (typeof value === "number" && value >= -eightBitStep && value <= 1 + eightBitStep),
    );
}

function spaceOf(name: ColorSpace): Space {
    return { name, ...inCuloriTerms[name] };
}

function spaceNamed(name: unknown): Space | undefined {
    const known = spaceNames.find((each) => each === name);
    return known && spaceOf(known);
}

function componentIn(text: string): ColorComponent | undefined {
    return text.trim() === "none" ? "none" : numberIn(text);
}
