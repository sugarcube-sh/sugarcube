import type {
    ColorComponent,
    ColorSpace,
    ColorValue,
    JsonObject,
    JsonValue,
} from "@sugarcube-sh/dtcg";
import { colorSpaces, isJsonObject, parseValue } from "@sugarcube-sh/dtcg/values";
import { roundColor } from "./round-color";
import { type Color, type Mode, converter, formatCss, formatHex, toGamut } from "culori";
import { parseNumber } from "./typed-text";

type Components = readonly [ColorComponent, ColorComponent, ColorComponent];

export type ColorField =
    | { readonly kind: "color"; readonly value: string; readonly color: Color }
    | {
          readonly kind: "color";
          readonly value: JsonObject;
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
          readonly original?: JsonObject;
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
const unitScale = [1, 1, 1] as const;

const culoriBySpace = {
    "srgb": { mode: "rgb", channels: rgb, scale: unitScale, gamut: sRGB },
    "srgb-linear": { mode: "lrgb", channels: rgb, scale: unitScale, gamut: sRGB },
    "hsl": { mode: "hsl", channels: ["h", "s", "l"], scale: [1, 100, 100], gamut: sRGB },
    "hwb": { mode: "hwb", channels: ["h", "w", "b"], scale: [1, 100, 100], gamut: sRGB },
    "lab": { mode: "lab", channels: ["l", "a", "b"], scale: unitScale },
    "lch": { mode: "lch", channels: ["l", "c", "h"], scale: unitScale },
    "oklab": { mode: "oklab", channels: ["l", "a", "b"], scale: unitScale },
    "oklch": { mode: "oklch", channels: ["l", "c", "h"], scale: unitScale },
    "display-p3": { mode: "p3", channels: rgb, scale: unitScale, gamut: displayP3 },
    "a98-rgb": {
        mode: "a98",
        channels: rgb,
        scale: unitScale,
        gamut: { name: "A98 RGB", mode: "a98" },
    },
    "prophoto-rgb": {
        mode: "prophoto",
        channels: rgb,
        scale: unitScale,
        gamut: { name: "ProPhoto RGB", mode: "prophoto" },
    },
    "rec2020": { mode: "rec2020", channels: rgb, scale: unitScale, gamut: rec2020 },
    "xyz-d65": { mode: "xyz65", channels: ["x", "y", "z"], scale: unitScale },
    "xyz-d50": { mode: "xyz50", channels: ["x", "y", "z"], scale: unitScale },
} as const satisfies Record<ColorSpace, Omit<Space, "name">>;

export const spaceNames = Object.keys(colorSpaces) as ColorSpace[];

export function parseColorField(value: JsonValue): ColorField | undefined {
    const parsed = parseValue("color", value, { references: false, hexStringColors: true });
    if (!parsed.ok) return undefined;
    if (typeof value === "string") {
        return { kind: "color", value, color: toCulori(getSpace("srgb"), parsed.value) };
    }
    const space = findSpace(parsed.value.colorSpace);
    return space && isJsonObject(value)
        ? {
              kind: "color",
              value,
              color: toCulori(space, parsed.value),
              space,
              components: parsed.value.components,
          }
        : undefined;
}

export function toColorDraft(field: ColorField | undefined): ColorDraft {
    if (!field) {
        return { kind: "color", colorSpace: "", components: ["", "", ""], alpha: "" };
    }
    if (!("space" in field)) return { kind: "hexColor", hex: field.value };
    const [a, b, c] = field.components;
    const { alpha } = field.value;
    return {
        kind: "color",
        colorSpace: field.space.name,
        components: [String(a), String(b), String(c)],
        alpha: typeof alpha === "number" ? String(alpha) : "",
        original: field.value,
    };
}

export function parseColorDraft(draft: ColorDraft): ColorField | undefined {
    if (draft.kind === "hexColor") return parseColorField(draft.hex);
    const space = findSpace(draft.colorSpace);
    const [a, b, c] = draft.components.map(parseComponent);
    const alpha = draft.alpha.trim() === "" ? undefined : parseNumber(draft.alpha);
    if (!space || a === undefined || b === undefined || c === undefined) return undefined;
    if (draft.alpha.trim() !== "" && alpha === undefined) return undefined;
    const opaque = alpha === undefined && draft.original && "alpha" in draft.original ? 1 : alpha;
    const components: Components = [a, b, c];
    const color = toCulori(space, { components, alpha: opaque ?? 1 });
    const value: JsonObject = {
        ...draft.original,
        colorSpace: space.name,
        components,
        ...(opaque !== undefined && { alpha: opaque }),
        ...(draft.original && "hex" in draft.original && { hex: formatHex(color) }),
    };
    return { kind: "color", value, color, space, components };
}

export function withComponent(
    draft: Extract<ColorDraft, { kind: "color" }>,
    index: number,
    text: string,
): Extract<ColorDraft, { kind: "color" }> {
    const [a, b, c] = draft.components;
    const pick = (position: number, previous: string) => (position === index ? text : previous);
    return { ...draft, components: [pick(0, a), pick(1, b), pick(2, c)] };
}

export function convertToSpace(
    draft: Extract<ColorDraft, { kind: "color" }>,
    name: string,
    fallback?: ColorField,
): { draft: Extract<ColorDraft, { kind: "color" }>; mappedGamut?: string } {
    const source = parseColorDraft(draft) ?? fallback;
    const space = findSpace(name);
    if (!source || !space) return { draft: { ...draft, colorSpace: name }, mappedGamut: undefined };
    const { gamut } = space;
    const targetGamut = gamut && !isInGamut(source.color, gamut) ? gamut : undefined;
    const color = targetGamut ? toGamut(targetGamut.mode, "oklch")(source.color) : source.color;
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
    const [x, y, z] = roundColor({ colorSpace: space.name, components: [a, b, c] }).components;
    return {
        draft: { ...draft, colorSpace: space.name, components: [String(x), String(y), String(z)] },
        mappedGamut: targetGamut?.name,
    };
}

export function findGamut(field: ColorField): string | undefined {
    return gamuts.find((gamut) => isInGamut(field.color, gamut))?.name;
}

export function getChannels(name: string): Channel[] {
    const space = findSpace(name);
    return space
        ? colorSpaces[space.name].map((channel) => {
              const { min, max } = channel.typicalRange ?? channel;
              const step = max - min > 1 ? 0.1 : 0.001;
              const top = channel.maxExclusive ? max - step : max;
              return { name: channel.name, min, max: top, step };
          })
        : [];
}

export function toColorCSS(field: ColorField): string {
    return typeof field.value === "string" ? field.value : formatCss(field.color);
}

export function getChannelTrack(field: ColorField, index: number): string {
    const channel = "space" in field ? getChannels(field.space.name)[index] : undefined;
    if (!("space" in field) || !channel) return "none";
    const stops = Array.from({ length: 7 }, (_, step) => {
        const value = channel.min + ((channel.max - channel.min) * step) / 6;
        const [a, b, c] = field.components.map((each, at) => (at === index ? value : each));
        const color = toCulori(field.space, {
            components: [a ?? "none", b ?? "none", c ?? "none"],
            alpha: field.color.alpha ?? 1,
        });
        return formatCss(color);
    });
    return `linear-gradient(to right, ${stops.join(", ")})`;
}

function toCulori(space: Space, value: Pick<ColorValue, "components" | "alpha">): Color {
    const color: Record<string, unknown> = { mode: space.mode, alpha: value.alpha };
    space.channels.forEach((channel, index) => {
        const component = value.components[index];
        if (typeof component === "number") color[channel] = component / (space.scale[index] ?? 1);
    });
    return color as unknown as Color;
}

function isInGamut(color: Color, gamut: Gamut): boolean {
    const channels = Object.entries(converter(gamut.mode)(color));
    return channels.every(
        ([key, value]) =>
            !["r", "g", "b"].includes(key) ||
            (typeof value === "number" && value >= -eightBitStep && value <= 1 + eightBitStep),
    );
}

function getSpace(name: ColorSpace): Space {
    return { name, ...culoriBySpace[name] };
}

function findSpace(name: unknown): Space | undefined {
    const known = spaceNames.find((each) => each === name);
    return known && getSpace(known);
}

function parseComponent(text: string): ColorComponent | undefined {
    return text.trim() === "none" ? "none" : parseNumber(text);
}
