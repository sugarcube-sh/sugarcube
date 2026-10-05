import { type Document, readFromMemory } from "@sugarcube-sh/dtcg";
import { describe, expect, it } from "vitest";
import { scaleGenerator } from "../src/shared/scale/generator.js";

const base = { min: { value: 1, unit: "rem" }, max: { value: 1.125, unit: "rem" } };
const exponential = {
    mode: "exponential",
    base,
    ratio: { min: 1.2, max: 1.25 },
    steps: { negative: 2, positive: 5 },
};
const multipliers = { mode: "multipliers", base, multipliers: { sm: 1, md: 1.5, lg: 2 } };

function read(group: Record<string, unknown>): Document {
    const text = JSON.stringify({ size: { $type: "dimension", ...group } });
    return readFromMemory({ files: { "tokens.json": text } }, { generators: [scaleGenerator] });
}

function withScale(scale: unknown, written: Record<string, unknown> = {}) {
    return read({ $extensions: { "sh.sugarcube": { scale } }, ...written });
}

function tokens(doc: Document) {
    return doc.permutations[0]?.tokens ?? [];
}

const rem = (value: number) => ({ value, unit: "rem" });

describe("scale generator", () => {
    it("adds an exponential scale's tokens, from the most negative step up", () => {
        const doc = withScale(exponential);
        expect(doc.diagnostics).toEqual([]);
        expect(tokens(doc).map((t) => t.path)).toEqual(
            ["-2", "-1", "0", "1", "2", "3", "4", "5"].map((step) => `size.${step}`),
        );
        expect(tokens(doc)[0]).toMatchObject({
            type: "dimension",
            resolved: rem(0.72),
            extensions: { "sh.sugarcube": { fluid: { min: rem(0.6944), max: rem(0.72) } } },
            generated: { from: "size" },
        });
        expect(tokens(doc)[0]).not.toHaveProperty("authored");
    });

    it("adds a multiplier scale's tokens in the multipliers' order, then its pairs", () => {
        const doc = withScale({ ...multipliers, pairs: "adjacent" });
        expect(doc.diagnostics).toEqual([]);
        expect(tokens(doc).map((t) => t.path)).toEqual(
            ["sm", "md", "lg", "sm-md", "md-lg"].map((step) => `size.${step}`),
        );
        expect(tokens(doc)[3]).toMatchObject({
            resolved: rem(1.6875),
            extensions: { "sh.sugarcube": { fluid: { min: rem(1), max: rem(1.6875) } } },
        });
    });

    it("keeps a token the file writes, and marks it as the scale's", () => {
        const doc = withScale(multipliers, { md: { $value: rem(1.1) } });
        const md = tokens(doc).find((t) => t.path === "size.md");
        expect(md).toMatchObject({ resolved: rem(1.1), generated: { from: "size" } });
        expect(md).toHaveProperty("authored");
    });

    it("reports a scale it cannot use, with old sugarcube's rule, and adds nothing", () => {
        const doc = withScale({ ...exponential, ratio: { min: 1, max: 1.25 } });
        expect(tokens(doc)).toEqual([]);
        expect(doc.diagnostics.map(({ kind, detail, path }) => ({ kind, detail, path }))).toEqual([
            {
                kind: "extension-invalid",
                detail: {
                    key: "sh.sugarcube",
                    at: ["$extensions", "sh.sugarcube", "scale", "ratio", "min"],
                    reason: "ratio-not-above-one",
                    data: { ratio: 1 },
                },
                path: "size",
            },
        ]);
    });

    it("reports a missing unit as missing, where old sugarcube called it an invalid unit", () => {
        const doc = withScale({ ...exponential, base: { min: { value: 1 }, max: base.max } });
        expect(doc.diagnostics.map(({ kind, detail }) => ({ kind, detail }))).toEqual([
            {
                kind: "invalid-value",
                detail: {
                    at: ["$extensions", "sh.sugarcube", "scale", "base", "min", "unit"],
                    type: "dimension",
                    reason: "missing-property",
                    property: "unit",
                },
            },
        ]);
    });

    it("checks pairs against the multipliers only when there are multipliers to check", () => {
        const doc = withScale({ mode: "multipliers", base, multipliers: {}, pairs: ["sm-lg"] });
        expect(doc.diagnostics.map(({ detail }) => detail)).toEqual([
            {
                key: "sh.sugarcube",
                at: ["$extensions", "sh.sugarcube", "scale", "multipliers"],
                reason: "no-multipliers",
            },
        ]);
    });

    it('reads its dimensions as dtcg does, so a string such as "16px" says what to write', () => {
        const doc = withScale({ ...exponential, base: { min: "16px", max: base.max } });
        expect(doc.diagnostics.map(({ kind, detail }) => ({ kind, detail }))).toEqual([
            {
                kind: "invalid-value",
                detail: {
                    at: ["$extensions", "sh.sugarcube", "scale", "base", "min"],
                    type: "dimension",
                    reason: "string-with-unit",
                    value: "16px",
                },
            },
        ]);
    });

    it("refuses a JSON Pointer reference too, which old sugarcube did not recognise", () => {
        const doc = withScale({
            ...exponential,
            base: { min: { $ref: "#/size/base/$value" }, max: base.max },
        });
        expect(doc.diagnostics.map(({ kind, detail }) => ({ kind, detail }))).toEqual([
            {
                kind: "invalid-value",
                detail: {
                    at: ["$extensions", "sh.sugarcube", "scale", "base", "min"],
                    type: "dimension",
                    reason: "reference-not-allowed",
                    reference: "#/size/base/$value",
                },
            },
        ]);
    });

    it("sets aside a property its base's dimensions do not define, with a warning, and still adds the scale", () => {
        const doc = withScale({
            ...multipliers,
            base: { ...base, min: { ...base.min, fluid: true } },
        });
        expect(tokens(doc).map((t) => t.path)).toEqual(["size.sm", "size.md", "size.lg"]);
        expect(
            doc.diagnostics.map(({ kind, severity, detail }) => ({ kind, severity, detail })),
        ).toEqual([
            {
                kind: "unknown-property",
                severity: "warning",
                detail: {
                    property: "fluid",
                    owner: "dimension",
                    at: ["$extensions", "sh.sugarcube", "scale", "base", "min", "fluid"],
                },
            },
        ]);
    });

    it("refuses a reference in a scale, as old sugarcube does", () => {
        const doc = withScale({
            ...multipliers,
            multipliers: { sm: "{multiplier.small}", md: 1.5 },
        });
        expect(tokens(doc)).toEqual([]);
        expect(doc.diagnostics.map(({ kind, detail }) => ({ kind, detail }))).toEqual([
            {
                kind: "invalid-value",
                detail: {
                    at: ["$extensions", "sh.sugarcube", "scale", "multipliers", "sm"],
                    type: "number",
                    reason: "reference-not-allowed",
                    reference: "{multiplier.small}",
                },
            },
        ]);
    });
});
