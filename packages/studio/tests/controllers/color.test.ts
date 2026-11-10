import type { JsonValue } from "@sugarcube-sh/dtcg";
import { colorSpaces } from "@sugarcube-sh/dtcg/values";
import { describe, expect, it } from "vitest";
import {
    channelsOf,
    spaceNames,
    withComponent,
    colorCss,
    colorDraft,
    gamutOf,
    inSpace,
    trackOf,
} from "../../src/controllers/color";
import { type Draft, draftFor, fieldFor, fieldFrom } from "../../src/controllers/value-field";

const brand = { colorSpace: "oklch", components: [0.624, 0.181, 258], hex: "#3884f2" };

function colorField(written: JsonValue) {
    const field = fieldFor("color", written);
    if (field.kind !== "color") throw new Error(field.kind);
    return field;
}

function objectDraft(written: JsonValue) {
    const draft = draftFor("color", colorField(written));
    if (draft.kind !== "color") throw new Error(draft.kind);
    return draft;
}

describe("fieldFor, a colour", () => {
    it("shows a colour written as the spec's object, or as a hex string", () => {
        expect(fieldFor("color", brand)).toMatchObject({ kind: "color", written: brand });
        expect(fieldFor("color", "#26262f1a")).toMatchObject({
            kind: "color",
            written: "#26262f1a",
        });
    });

    it("shows a component written 'none', as the spec allows", () => {
        const grey = { colorSpace: "oklch", components: [0.5, 0, "none"] };

        expect(fieldFor("color", grey)).toMatchObject({ kind: "color", written: grey });
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
            expect(fieldFor("color", odd)).toEqual({ kind: "json", value: odd });
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
        expect(draftFor("color", colorField("#26262f1a"))).toEqual({
            kind: "hexColor",
            hex: "#26262f1a",
        });
    });

    it("starts blank for a new colour", () => {
        expect(draftFor("color", undefined)).toMatchObject({
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

        const made = fieldFrom(draft);

        expect(made?.kind === "color" && made.written).toEqual({
            colorSpace: "oklch",
            hex: expect.stringMatching(/^#[0-9a-f]{6}$/),
            components: [0.97123, 0.0134567, 258],
        });
        expect(Object.keys(made?.kind === "color" ? (made.written as object) : {})).toEqual([
            "colorSpace",
            "hex",
            "components",
        ]);
    });

    it("works the hex out again from the colour, where the file has one", () => {
        const black = objectDraft({ colorSpace: "srgb", components: [0, 0, 0], hex: "#000000" });

        expect(fieldFrom({ ...black, components: ["1", "0", "0"] as const })).toMatchObject({
            written: { colorSpace: "srgb", components: [1, 0, 0], hex: "#ff0000" },
        });
    });

    it("writes alpha when typed, or when the file has it", () => {
        const plain = objectDraft({ colorSpace: "srgb", components: [1, 0, 0] });

        expect(fieldFrom(plain)?.kind === "color" && fieldFrom(plain)).toMatchObject({
            written: { colorSpace: "srgb", components: [1, 0, 0] },
        });
        expect(fieldFrom({ ...plain, alpha: "0.5" })).toMatchObject({
            written: { colorSpace: "srgb", components: [1, 0, 0], alpha: 0.5 },
        });
        const translucent = objectDraft({ colorSpace: "srgb", components: [1, 0, 0], alpha: 0.5 });
        expect(fieldFrom({ ...translucent, alpha: "" })).toMatchObject({
            written: { colorSpace: "srgb", components: [1, 0, 0], alpha: 1 },
        });
    });

    it("reads 'none' typed for a component", () => {
        const draft = { ...objectDraft(brand), components: ["0.5", "0", "none"] as const };

        expect(fieldFrom(draft)).toMatchObject({
            written: { components: [0.5, 0, "none"] },
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

        for (const each of half) expect(fieldFrom(each)).toBeUndefined();
    });

    it("writes a hex colour as typed", () => {
        expect(fieldFrom({ kind: "hexColor", hex: "#2a2a33cc" })).toMatchObject({
            kind: "color",
            written: "#2a2a33cc",
        });
    });
});

describe("inSpace", () => {
    const vivid = { colorSpace: "oklch", components: [0.7, 0.28, 145] };

    it("converts to another colour space, writing what it works out to four decimal places", () => {
        expect(inSpace(objectDraft(brand), "display-p3")).toEqual({
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
            inSpace(objectDraft({ colorSpace: "srgb", components: [0.2, 0.4, 0.6] }), "hsl").draft,
        ).toMatchObject({ colorSpace: "hsl", components: ["210", "50", "40"] });
    });

    it("reduces chroma to fit a colour space that can't hold the colour, and says so", () => {
        const { draft, fitted } = inSpace(objectDraft(vivid), "srgb");

        expect(fitted).toBe("sRGB");
        for (const component of draft.components) {
            expect(Number(component)).toBeGreaterThanOrEqual(0);
            expect(Number(component)).toBeLessThanOrEqual(1);
        }
        const hsl = inSpace(objectDraft(vivid), "hsl");
        expect(hsl.fitted).toBe("sRGB");
        expect(Number(hsl.draft.components[1])).toBeLessThanOrEqual(100);
    });

    it("keeps the hue when it reduces chroma, where clipping each channel would not", () => {
        const yellow = objectDraft({ colorSpace: "oklch", components: [0.5, 0.3, 85] });

        const fitted = fieldFrom(inSpace(yellow, "srgb").draft);
        const again = fitted?.kind === "color" ? colorDraft(fitted) : yellow;
        const back = again.kind === "color" ? inSpace(again, "oklch").draft : yellow;

        expect(Math.abs(Number(back.components[2]) - 85)).toBeLessThan(10);
    });

    it("leaves a colour as it is where the colour space can hold it", () => {
        expect(inSpace(objectDraft(vivid), "display-p3").fitted).toBeUndefined();
        expect(inSpace(objectDraft(vivid), "oklab").fitted).toBeUndefined();
        expect(inSpace(objectDraft(brand), "srgb").fitted).toBeUndefined();
    });

    it("converts the last whole colour while a box is half typed, not the half-typed numbers", () => {
        const draft = { ...objectDraft(brand), components: ["0.5", "", "258"] as const };

        const converted = inSpace(draft, "oklch", colorField(brand)).draft;

        expect(converted.components).toEqual(["0.624", "0.181", "258"]);
    });

    it("only changes the colour space when there is no colour yet", () => {
        const blank = draftFor("color", undefined);
        if (blank.kind !== "color") throw new Error(blank.kind);

        expect(inSpace(blank, "lab")).toEqual({
            draft: { ...blank, colorSpace: "lab" },
            fitted: undefined,
        });
    });
});

describe("gamutOf", () => {
    it("names the smallest gamut that holds the colour, or none", () => {
        expect(gamutOf(colorField(brand))).toBe("sRGB");
        expect(gamutOf(colorField("#26262f1a"))).toBe("sRGB");
        expect(gamutOf(colorField({ colorSpace: "oklch", components: [0.7, 0.28, 145] }))).toBe(
            "Display P3",
        );
        expect(gamutOf(colorField({ colorSpace: "oklch", components: [0.6, 0.28, 0] }))).toBe(
            "Rec. 2020",
        );
        expect(
            gamutOf(colorField({ colorSpace: "oklch", components: [0.85, 0.4, 145] })),
        ).toBeUndefined();
    });

    it("counts a colour at the edge of a gamut as inside it, after rounding", () => {
        const cyan = inSpace(
            objectDraft({ colorSpace: "srgb", components: [0, 1, 1] }),
            "oklch",
        ).draft;
        const field = fieldFrom(cyan);

        expect(field?.kind === "color" && gamutOf(field)).toBe("sRGB");
        const back = inSpace(cyan, "srgb");
        expect(back.fitted).toBeUndefined();
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

describe("channelsOf", () => {
    it("gives each channel a slider's range and step, from the spec's ranges", () => {
        expect(channelsOf("oklch")).toEqual([
            { name: "Lightness", min: 0, max: 1, step: 0.001 },
            { name: "Chroma", min: 0, max: 0.5, step: 0.001 },
            { name: "Hue", min: 0, max: 359.9, step: 0.1 },
        ]);
        expect(channelsOf("hsl")[0]).toEqual({ name: "Hue", min: 0, max: 359.9, step: 0.1 });
        expect(channelsOf("lab")[1]).toEqual({ name: "A", min: -160, max: 160, step: 0.1 });
    });
});

describe("colorCss and trackOf", () => {
    it("writes the colour in its own space, for the swatch", () => {
        expect(colorCss(colorField(brand))).toBe("oklch(0.624 0.181 258)");
        expect(colorCss(colorField({ colorSpace: "hsl", components: [210, 50, 40] }))).toBe(
            "hsl(210 50% 40%)",
        );
        expect(colorCss(colorField("#26262f1a"))).toBe("#26262f1a");
    });

    it("draws a channel's track as the colour across that channel's range", () => {
        const track = trackOf(colorField(brand), 0);

        expect(track.startsWith("linear-gradient(to right, oklch(0 0.181 258)")).toBe(true);
        expect(track.endsWith("oklch(1 0.181 258))")).toBe(true);
    });
});
