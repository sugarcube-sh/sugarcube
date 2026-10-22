import type { Group, JsonValue, Token } from "@sugarcube-sh/dtcg";
import { describe, expect, it } from "vitest";
import type { ExtensionForm } from "../../src/controllers/adapter";
import { createStudio } from "../../src/controllers/studio";
import { adapterFor } from "../../src/adapters";
import { demoFiles, demoMessage, plainMessage } from "../controllers/demo-message";

const rem = (value: number) => ({ value, unit: "rem" });

function demoStudio(files = demoFiles()) {
    return createStudio(demoMessage({ files }), adapterFor);
}

function json(studio: ReturnType<typeof demoStudio>, file: string): Record<string, JsonValue> {
    return JSON.parse(studio.state.tokens.text(file) ?? "null");
}

function token(studio: ReturnType<typeof demoStudio>, path: string): Token {
    const found = studio.state.showing.token(path);
    if (!found) throw new Error(`the demo has no ${path}`);
    return found;
}

function group(studio: ReturnType<typeof demoStudio>, path: string): Group {
    const found = studio.state.showing.group(path);
    if (!found) throw new Error(`the demo has no group ${path}`);
    return found;
}

function formAt(studio: ReturnType<typeof demoStudio>, path: string): ExtensionForm | undefined {
    const [place] = studio.state.tokens.writtenAt(path);
    return studio.state.formFor(token(studio, path), place?.span);
}

const shown = (form: ExtensionForm | undefined) =>
    form && {
        label: form.label,
        fields: form.fields.map(({ label, type, value }) => ({ label, type, value })),
        writes: form.write !== undefined,
    };

describe("sugarcube's fluid form", () => {
    it("shows a fluid token's range, as written at its place", () => {
        expect(shown(formAt(demoStudio(), "size.fluid.gutter"))).toEqual({
            label: "Fluid",
            fields: [
                { label: "From", type: "dimension", value: rem(1) },
                { label: "To", type: "dimension", value: rem(2) },
            ],
            writes: true,
        });
    });

    it("writes From as the range's min, and the CSS follows", () => {
        const studio = demoStudio();
        const form = formAt(studio, "size.fluid.gutter");
        const min = form?.fields.find(({ label }) => label === "From");
        if (!form?.write || !min) throw new Error("gutter has a fluid form");

        studio.do(form.write(min.key, rem(1.5)));

        const gutter = token(studio, "size.fluid.gutter");
        expect(gutter.extensions?.["sh.sugarcube"]).toMatchObject({
            fluid: { min: rem(1.5), max: rem(2) },
        });
        expect(studio.state.value(gutter)).toBe("clamp(1.5rem, 1.3182rem + 0.9091vw, 2rem)");
    });

    it("writes To as the range's max and the token's value, in one step", () => {
        const studio = demoStudio();
        const form = formAt(studio, "size.fluid.gutter");
        const max = form?.fields.find(({ label }) => label === "To");
        if (!form?.write || !max) throw new Error("gutter has a fluid form");

        studio.do(form.write(max.key, rem(2.5)));

        expect(studio.unsaved.steps).toHaveLength(1);
        const gutter = token(studio, "size.fluid.gutter");
        expect(gutter.authored?.value).toEqual(rem(2.5));
        expect(gutter.extensions?.["sh.sugarcube"]).toMatchObject({ fluid: { max: rem(2.5) } });
    });

    it("is not offered without a place, as for an override row not yet written", () => {
        const studio = demoStudio();

        expect(studio.state.formFor(token(studio, "size.fluid.gutter"))).toBeUndefined();
    });

    it("is not offered for a token with no fluid range", () => {
        expect(formAt(demoStudio(), "color.brand.500")).toBeUndefined();
    });

    it("shows a recipe's step as read only, from the step's own range", () => {
        const studio = demoStudio();

        expect(shown(studio.state.formFor(token(studio, "size.step.-1")))).toEqual({
            label: "Fluid",
            fields: [
                { label: "From", type: "dimension", value: rem(0.8333) },
                { label: "To", type: "dimension", value: rem(0.9) },
            ],
            writes: false,
        });
    });
});

describe("sugarcube's scale form", () => {
    it("shows an exponential recipe's settings on its group", () => {
        const studio = demoStudio();

        expect(shown(studio.state.formFor(group(studio, "size.step")))).toEqual({
            label: "Scale",
            fields: [
                { label: "Base from", type: "dimension", value: rem(1) },
                { label: "Base to", type: "dimension", value: rem(1.125) },
                { label: "Ratio from", type: "number", value: 1.2 },
                { label: "Ratio to", type: "number", value: 1.25 },
                { label: "Steps below", type: "number", value: 2 },
                { label: "Steps above", type: "number", value: 5 },
            ],
            writes: true,
        });
    });

    it("writes one setting of the recipe, keeping the rest, and every step follows", () => {
        const studio = demoStudio();
        const form = studio.state.formFor(group(studio, "size.step"));
        const ratio = form?.fields.find(({ label }) => label === "Ratio to");
        if (!form?.write || !ratio) throw new Error("size.step has a scale form");

        const done = studio.do(form.write(ratio.key, 1.333));

        expect(done).toMatchObject({
            ops: [
                {
                    kind: "set",
                    file: "size.json",
                    jsonPath: [
                        "size",
                        "step",
                        "$extensions",
                        "sh.sugarcube",
                        "scale",
                        "ratio",
                        "max",
                    ],
                    value: 1.333,
                    was: 1.25,
                },
            ],
        });
        expect(json(studio, "size.json")).toMatchObject({
            size: { step: { $extensions: { "sh.sugarcube": { measures: "font-size" } } } },
        });
        expect(studio.state.value(token(studio, "size.step.5"))).toBe(
            "clamp(2.4883rem, 1.6714rem + 4.0845vw, 4.7348rem)",
        );
    });

    it("shows a multiplier recipe's base and each multiplier by its name", () => {
        const studio = demoStudio();

        expect(shown(studio.state.formFor(group(studio, "space")))?.fields).toEqual([
            { label: "Base from", type: "dimension", value: rem(1) },
            { label: "Base to", type: "dimension", value: rem(1.25) },
            { label: "xs", type: "number", value: 0.25 },
            { label: "sm", type: "number", value: 0.5 },
            { label: "md", type: "number", value: 1 },
            { label: "lg", type: "number", value: 1.5 },
            { label: "xl", type: "number", value: 2.5 },
            { label: "2xl", type: "number", value: 4 },
        ]);
    });

    it("writes a multiplier, and shows pairs in the JSON box when the recipe has them", () => {
        const files = demoFiles();
        const paired = files["space.json"]!.replace(
            '"multipliers": {',
            '"pairs": "adjacent",\n          "multipliers": {',
        );
        expect(paired).not.toBe(files["space.json"]);
        const studio = demoStudio({ ...files, "space.json": paired });
        const form = studio.state.formFor(group(studio, "space"));
        const md = form?.fields.find(({ label }) => label === "md");
        if (!form?.write || !md) throw new Error("space has a scale form");

        expect(form.fields.at(-1)).toMatchObject({
            label: "Pairs",
            type: undefined,
            value: "adjacent",
        });
        studio.do(form.write(md.key, 1.25));
        expect(json(studio, "space.json")).toMatchObject({
            space: { $extensions: { "sh.sugarcube": { scale: { multipliers: { md: 1.25 } } } } },
        });
    });

    it("is not offered for a group with no recipe", () => {
        const studio = demoStudio();

        expect(studio.state.formFor(group(studio, "color"))).toBeUndefined();
    });
});

describe("the plain adapter", () => {
    it("offers no forms", () => {
        const studio = createStudio(plainMessage(), adapterFor);
        const [first] = studio.state.showing.tokens;

        expect(first && studio.state.formFor(first)).toBeUndefined();
    });
});
