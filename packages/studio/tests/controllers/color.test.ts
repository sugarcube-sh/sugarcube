import type { JsonValue } from "@sugarcube-sh/dtcg";
import { colorSpaces } from "@sugarcube-sh/dtcg/values";
import { describe, expect, it } from "vitest";
import {
    getChannels,
    spaceNames,
    withComponent,
    toColorCSS,
    toColorDraft,
    findGamut,
    convertToSpace,
    getChannelTrack,
} from "../../src/controllers/color";
import { type Draft, toDraft, parseField, parseDraft } from "../../src/controllers/value-field";

const brand = { colorSpace: "oklch", components: [0.624, 0.181, 258], hex: "#3884f2" };

function parseColor(value: JsonValue) {
    const field = parseField("color", value);
    if (field.kind !== "color") throw new Error(field.kind);
    return field;
}

function objectDraft(value: JsonValue) {
    const draft = toDraft("color", parseColor(value));
    if (draft.kind !== "color") throw new Error(draft.kind);
    return draft;
}

describe("parseField, a colour", () => {
    it("shows a colour written as the spec's object, or as a hex string", () => {
        expect(parseField("color", brand)).toMatchObject({ kind: "color", value: brand });
        expect(parseField("color", "#26262f1a")).toMatchObject({
            kind: "color",
            value: "#26262f1a",
        });
    });

    it("shows a component written 'none', as the spec allows", () => {
        const grey = { colorSpace: "oklch", components: [0.5, 0, "none"] };

        expect(parseField("color", grey)).toMatchObject({ kind: "color", value: grey });
    });

    it("falls back to JSON for a colour it can't show exactly", () => {
        for (const odd of [
            { ...brand, name: "brand" },
            { colorSpace: "oklch", components: [0.5, 0.1] },
            { colorSpace: "cmyk", components: [0, 0, 0] },
            "red",
            "#12345",
            "#fff",
            "#ffff",
        ]) {
            expect(parseField("color", odd)).toEqual({ kind: "json", value: odd });
        }
    });
});

describe("a colour's draft", () => {
    it("starts from the components as written", () => {
        expect(objectDraft(brand)).toMatchObject({
            kind: "color",
            colorSpace: "oklch",
            components: ["0.624", "0.181", "258"],
            alpha: "",
        });
        expect(
            objectDraft({ colorSpace: "oklch", components: [0.5, 0, "none"], alpha: 0.5 }),
        ).toMatchObject({ components: ["0.5", "0", "none"], alpha: "0.5" });
        expect(toDraft("color", parseColor("#26262f1a"))).toEqual({
            kind: "hexColor",
            hex: "#26262f1a",
        });
    });

    it("starts blank for a new colour", () => {
        expect(toDraft("color", undefined)).toMatchObject({
            kind: "color",
            colorSpace: "",
            components: ["", "", ""],
            alpha: "",
        });
    });

    it("writes exactly what is typed, keeping the members the file has, in its order", () => {
        const written = { colorSpace: "oklch", hex: "#3884f2", components: [0.624, 0.181, 258] };
        const draft = {
            ...objectDraft(written),
            components: ["0.97123", "0.0134567", "258"] as const,
        };

        const made = parseDraft(draft);

        expect(made?.kind === "color" && made.value).toEqual({
            colorSpace: "oklch",
            hex: expect.stringMatching(/^#[0-9a-f]{6}$/),
            components: [0.97123, 0.0134567, 258],
        });
        expect(Object.keys(made?.kind === "color" ? (made.value as object) : {})).toEqual([
            "colorSpace",
            "hex",
            "components",
        ]);
    });

    it("works the hex out again from the colour, where the file has one", () => {
        const black = objectDraft({ colorSpace: "srgb", components: [0, 0, 0], hex: "#000000" });

        expect(parseDraft({ ...black, components: ["1", "0", "0"] as const })).toMatchObject({
            value: { colorSpace: "srgb", components: [1, 0, 0], hex: "#ff0000" },
        });
    });

    it("writes alpha when typed, or when the file has it", () => {
        const plain = objectDraft({ colorSpace: "srgb", components: [1, 0, 0] });

        expect(parseDraft(plain)?.kind === "color" && parseDraft(plain)).toMatchObject({
            value: { colorSpace: "srgb", components: [1, 0, 0] },
        });
        expect(parseDraft({ ...plain, alpha: "0.5" })).toMatchObject({
            value: { colorSpace: "srgb", components: [1, 0, 0], alpha: 0.5 },
        });
        const translucent = objectDraft({ colorSpace: "srgb", components: [1, 0, 0], alpha: 0.5 });
        expect(parseDraft({ ...translucent, alpha: "" })).toMatchObject({
            value: { colorSpace: "srgb", components: [1, 0, 0], alpha: 1 },
        });
    });

    it("reads 'none' typed for a component", () => {
        const draft = { ...objectDraft(brand), components: ["0.5", "0", "none"] as const };

        expect(parseDraft(draft)).toMatchObject({
            value: { components: [0.5, 0, "none"] },
        });
    });

    it("writes nothing while a component or the colour space is half done", () => {
        const draft = objectDraft(brand);
        const half: Draft[] = [
            { ...draft, components: ["0.5", "", "258"] as const },
            { ...draft, components: ["0.5", "0.1e", "258"] as const },
            { ...draft, alpha: "-" },
            { ...draft, colorSpace: "" },
            { kind: "hexColor", hex: "#12345" },
            { kind: "hexColor", hex: "#fff" },
        ];

        for (const each of half) expect(parseDraft(each)).toBeUndefined();
    });

    it("writes a hex colour as typed", () => {
        expect(parseDraft({ kind: "hexColor", hex: "#2a2a33cc" })).toMatchObject({
            kind: "color",
            value: "#2a2a33cc",
        });
    });
});

describe("convertToSpace", () => {
    const vivid = { colorSpace: "oklch", components: [0.7, 0.28, 145] };

    it("converts to another colour space, writing what it works out to four decimal places", () => {
        expect(convertToSpace(objectDraft(brand), "display-p3")).toEqual({
            draft: expect.objectContaining({
                colorSpace: "display-p3",
                components: [
                    expect.stringMatching(/^0\.\d{1,4}$/),
                    expect.stringMatching(/^0\.\d{1,4}$/),
                    expect.stringMatching(/^0\.\d{1,4}$/),
                ],
            }),
            fitted: undefined,
        });
        expect(
            convertToSpace(objectDraft({ colorSpace: "srgb", components: [0.2, 0.4, 0.6] }), "hsl")
                .draft,
        ).toMatchObject({ colorSpace: "hsl", components: ["210", "50", "40"] });
    });

    it("reduces chroma to fit a colour space that can't hold the colour, and says so", () => {
        const { draft, mappedGamut } = convertToSpace(objectDraft(vivid), "srgb");

        expect(mappedGamut).toBe("sRGB");
        for (const component of draft.components) {
            expect(Number(component)).toBeGreaterThanOrEqual(0);
            expect(Number(component)).toBeLessThanOrEqual(1);
        }
        const hsl = convertToSpace(objectDraft(vivid), "hsl");
        expect(hsl.mappedGamut).toBe("sRGB");
        expect(Number(hsl.draft.components[1])).toBeLessThanOrEqual(100);
    });

    it("keeps the hue when it reduces chroma, where clipping each channel would not", () => {
        const yellow = objectDraft({ colorSpace: "oklch", components: [0.5, 0.3, 85] });

        const fitted = parseDraft(convertToSpace(yellow, "srgb").draft);
        const again = fitted?.kind === "color" ? toColorDraft(fitted) : yellow;
        const back = again.kind === "color" ? convertToSpace(again, "oklch").draft : yellow;

        expect(Math.abs(Number(back.components[2]) - 85)).toBeLessThan(10);
    });

    it("leaves a colour as it is where the colour space can hold it", () => {
        expect(convertToSpace(objectDraft(vivid), "display-p3").mappedGamut).toBeUndefined();
        expect(convertToSpace(objectDraft(vivid), "oklab").mappedGamut).toBeUndefined();
        expect(convertToSpace(objectDraft(brand), "srgb").mappedGamut).toBeUndefined();
    });

    it("converts the last whole colour while a box is half typed, not the half-typed numbers", () => {
        const draft = { ...objectDraft(brand), components: ["0.5", "", "258"] as const };

        const converted = convertToSpace(draft, "oklch", parseColor(brand)).draft;

        expect(converted.components).toEqual(["0.624", "0.181", "258"]);
    });

    it("only changes the colour space when there is no colour yet", () => {
        const blank = toDraft("color", undefined);
        if (blank.kind !== "color") throw new Error(blank.kind);

        expect(convertToSpace(blank, "lab")).toEqual({
            draft: { ...blank, colorSpace: "lab" },
            fitted: undefined,
        });
    });
});

describe("findGamut", () => {
    it("names the smallest gamut that holds the colour, or none", () => {
        expect(findGamut(parseColor(brand))).toBe("sRGB");
        expect(findGamut(parseColor("#26262f1a"))).toBe("sRGB");
        expect(findGamut(parseColor({ colorSpace: "oklch", components: [0.7, 0.28, 145] }))).toBe(
            "Display P3",
        );
        expect(findGamut(parseColor({ colorSpace: "oklch", components: [0.6, 0.28, 0] }))).toBe(
            "Rec. 2020",
        );
        expect(
            findGamut(parseColor({ colorSpace: "oklch", components: [0.85, 0.4, 145] })),
        ).toBeUndefined();
    });

    it("counts a colour at the edge of a gamut as inside it, after rounding", () => {
        const cyan = convertToSpace(
            objectDraft({ colorSpace: "srgb", components: [0, 1, 1] }),
            "oklch",
        ).draft;
        const field = parseDraft(cyan);

        expect(field?.kind === "color" && findGamut(field)).toBe("sRGB");
        const back = convertToSpace(cyan, "srgb");
        expect(back.mappedGamut).toBeUndefined();
        expect(back.draft.components).toEqual(["0", "1", "1"]);
    });
});

describe("withComponent", () => {
    it("changes one component of the draft", () => {
        expect(withComponent(objectDraft(brand), 1, "0.2").components).toEqual([
            "0.624",
            "0.2",
            "258",
        ]);
    });
});

describe("spaceNames", () => {
    it("lists every colour space the Color module defines, from dtcg", () => {
        expect(spaceNames).toEqual(Object.keys(colorSpaces));
    });
});

describe("getChannels", () => {
    it("gives each channel a slider's range and step, from the spec's ranges", () => {
        expect(getChannels("oklch")).toEqual([
            { name: "Lightness", min: 0, max: 1, step: 0.001 },
            { name: "Chroma", min: 0, max: 0.5, step: 0.001 },
            { name: "Hue", min: 0, max: 359.9, step: 0.1 },
        ]);
        expect(getChannels("hsl")[0]).toEqual({ name: "Hue", min: 0, max: 359.9, step: 0.1 });
        expect(getChannels("lab")[1]).toEqual({ name: "A", min: -160, max: 160, step: 0.1 });
    });
});

describe("toColorCSS and getChannelTrack", () => {
    it("writes the colour in its own space, for the swatch", () => {
        expect(toColorCSS(parseColor(brand))).toBe("oklch(0.624 0.181 258)");
        expect(toColorCSS(parseColor({ colorSpace: "hsl", components: [210, 50, 40] }))).toBe(
            "hsl(210 50% 40%)",
        );
        expect(toColorCSS(parseColor("#26262f1a"))).toBe("#26262f1a");
    });

    it("draws a channel's track as the colour across that channel's range", () => {
        const track = getChannelTrack(parseColor(brand), 0);

        expect(track.startsWith("linear-gradient(to right, oklch(0 0.181 258)")).toBe(true);
        expect(track.endsWith("oklch(1 0.181 258))")).toBe(true);
    });
});
