import { describe, expect, it } from "vitest";
import { diagnosticMessages } from "../../src/error-messages.js";
import {
    type DiagnosticDetailByKind,
    type DiagnosticKind,
    type Generator,
    defineGenerator,
    readFromMemory,
} from "../../src/index.js";
import { valueErrorMessages } from "../../src/values/value-errors.js";
import { dimensionUnits, durationUnits, lineCaps, strokeStyleKeywords } from "../../src/values.js";

const examples: { [K in DiagnosticKind]: DiagnosticDetailByKind[K][] } = {
    "file-not-found": [
        { file: "dark.json" },
        { file: "dark.json", referencedFrom: "tokens.resolver.json" },
    ],
    "invalid-json": [
        { reason: "comment" },
        { reason: "not-an-object" },
        { reason: "comma-expected" },
    ],
    "duplicate-key": [{ key: "brand" }],
    "resolver-invalid": [
        { rule: "version", name: "version", at: ["version"] },
        { rule: "missing-property", name: "sources", at: ["sets", "base"] },
        { rule: "wrong-type", name: "sources", at: ["sets", "base", "sources"], expected: "array" },
        { rule: "unknown-item-type", name: "group", at: ["resolutionOrder", 0, "type"] },
        {
            rule: "resolver-as-source",
            name: "other.resolver.json",
            at: ["sets", "base", "sources", 0],
        },
        { rule: "unknown-set", name: "base", at: ["resolutionOrder", 0, "$ref"] },
        { rule: "unknown-modifier", name: "theme", at: ["resolutionOrder", 1, "$ref"] },
        { rule: "invalid-pointer", name: "#/modifiers/theme", at: ["sets", "base", "sources", 0] },
        { rule: "circular-reference", name: "#/sets/base", at: ["sets", "base", "sources", 0] },
        { rule: "duplicate-name", name: "base", at: ["resolutionOrder", 1, "name"] },
        { rule: "no-contexts", name: "theme", at: ["modifiers", "theme", "contexts"] },
        { rule: "single-context", name: "theme", at: ["modifiers", "theme", "contexts"] },
        { rule: "invalid-default", name: "theme", at: ["modifiers", "theme", "default"] },
    ],
    "input-invalid": [
        { reason: "unknown-modifier", input: 0, modifier: "size", valid: ["theme"] },
        {
            reason: "unknown-context",
            input: 0,
            modifier: "theme",
            context: "blue",
            valid: ["light", "dark"],
        },
        { reason: "missing-modifier", input: 0, modifier: "theme" },
        { reason: "not-a-string", input: 0, modifier: "beta" },
    ],
    "invalid-name": [
        { name: "$brand", character: "$" },
        { name: "a.b", character: "." },
    ],
    "token-and-group": [{}],
    "invalid-member": [
        { name: "brand", found: "string" },
        { name: "sizes", found: "array" },
    ],
    "invalid-property": [
        { property: "$description", expected: "string" },
        { property: "$deprecated", expected: "boolean-or-string" },
        { property: "$extensions", expected: "object" },
        { property: "$extends", expected: "reference" },
    ],
    "missing-type": [{}],
    "unknown-type": [{ type: "colour" }],
    "invalid-value": [
        { at: ["$value"], type: "dimension", reason: "wrong-shape", value: 16 },
        { at: ["$value"], type: "shadow", reason: "wrong-shape", value: "0 1px 2px black" },
        { at: ["$value"], type: "typography", reason: "wrong-shape", value: [] },
        { at: ["$value", "blurr"], type: "shadow", reason: "unknown-property", property: "blurr" },
        { at: ["$value", "$ref"], type: "color", reason: "pointer-not-alone" },
        { at: ["$value", "blur"], type: "shadow", reason: "missing-property", property: "blur" },
        { at: ["$value", "value"], type: "dimension", reason: "not-a-number", value: "16" },
        { at: ["$value", "value"], type: "dimension", reason: "not-a-number", value: null },
        {
            at: ["$value", 0],
            type: "fontFamily",
            reason: "alias-not-allowed-here",
            reference: "{font.brand}",
        },
        { at: ["$value"], type: "color", reason: "hex-string", value: "#e11d48" },
        {
            at: ["$value", "colorSpace"],
            type: "color",
            reason: "unknown-color-space",
            value: "rgb",
        },
        { at: ["$value", "colorSpace"], type: "color", reason: "unknown-color-space", value: 5 },
        {
            at: ["$value", "components"],
            type: "color",
            reason: "not-three-components",
            value: [1, 0, 0, 1],
        },
        {
            at: ["$value", "components"],
            type: "color",
            reason: "not-three-components",
            value: "1 0 0",
        },
        {
            at: ["$value", "components", 1],
            type: "color",
            reason: "component-not-a-number",
            value: "0.5",
        },
        {
            at: ["$value", "components", 2],
            type: "color",
            reason: "component-out-of-range",
            value: 400,
            colorSpace: "oklch",
            component: "H",
            min: 0,
            max: 360,
            maxExclusive: true,
        },
        {
            at: ["$value", "components", 0],
            type: "color",
            reason: "component-out-of-range",
            value: 1.1,
            colorSpace: "srgb",
            component: "R",
            min: 0,
            max: 1,
            maxExclusive: false,
        },
        {
            at: ["$value", "components", 1],
            type: "color",
            reason: "component-out-of-range",
            value: -0.1,
            colorSpace: "oklch",
            component: "C",
            min: 0,
            maxExclusive: false,
        },
        { at: ["$value", "alpha"], type: "color", reason: "alpha-out-of-range", value: 1.5 },
        { at: ["$value", "hex"], type: "color", reason: "hex-not-six-digits", value: "#e1d" },
        { at: ["$value", "hex"], type: "color", reason: "hex-not-six-digits", value: 16711680 },
        { at: ["$value"], type: "dimension", reason: "string-with-unit", value: "16px" },
        { at: ["$value"], type: "duration", reason: "string-with-unit", value: "200ms" },
        { at: ["$value"], type: "cubicBezier", reason: "not-four-numbers", count: 3 },
        {
            at: ["$value", 0],
            type: "cubicBezier",
            reason: "x-out-of-range",
            value: 1.2,
            coordinate: "x1",
        },
        { at: ["$value"], type: "fontFamily", reason: "empty-font-list" },
        { at: ["$value", 1], type: "fontFamily", reason: "not-a-font-name", value: 4 },
        { at: ["$value"], type: "fontFamily", reason: "not-a-font-name", value: "  " },
        {
            at: ["$value"],
            type: "strokeStyle",
            reason: "unknown-stroke-style-keyword",
            value: "thick",
            keywords: strokeStyleKeywords,
        },
        {
            at: ["$value", "dashArray"],
            type: "strokeStyle",
            reason: "dash-array-not-a-list",
            value: "4px 2px",
        },
        { at: ["$value", "dashArray"], type: "strokeStyle", reason: "empty-dash-array" },
        {
            at: ["$value", "lineCap"],
            type: "strokeStyle",
            reason: "unknown-line-cap",
            value: "flat",
            lineCaps,
        },
        { at: ["$value"], type: "shadow", reason: "no-shadows" },
        { at: ["$value"], type: "gradient", reason: "no-gradient-stops" },
        { at: ["$value", "inset"], type: "shadow", reason: "not-a-boolean", value: "yes" },
        { at: ["$value"], type: "fontWeight", reason: "font-weight-out-of-range", value: 1200 },
        {
            at: ["$value"],
            type: "fontWeight",
            reason: "unknown-font-weight-keyword",
            value: "Bold",
        },
        {
            at: ["$value"],
            type: "fontWeight",
            reason: "unknown-font-weight-keyword",
            value: "heavyweight",
        },
        {
            at: ["base", "min"],
            type: "dimension",
            reason: "reference-not-allowed",
            reference: "{space.md}",
        },
        {
            at: ["$value", "unit"],
            type: "dimension",
            reason: "unit-not-allowed",
            unit: "em",
            allowed: dimensionUnits,
        },
        {
            at: ["$value", "unit"],
            type: "duration",
            reason: "unit-not-allowed",
            unit: 5,
            allowed: durationUnits,
        },
    ],
    "hex-string-color": [{ value: "#e11d48" }],
    "extension-invalid": [
        { key: "sh.sugarcube", at: ["$extensions", "sh.sugarcube", "scale", "mode"] },
        {
            key: "sh.sugarcube",
            at: ["$extensions", "sh.sugarcube", "scale", "ratio", "min"],
            reason: "ratio-not-above-one",
            data: { ratio: 1 },
        },
    ],
    "missing-reference": [{ ref: "color.brnad", referencedBy: ["color.danger"] }],
    "not-a-group": [{ ref: "color.brand" }],
    "not-a-token": [{ ref: "color.accent" }],
    "reference-to-several": [{ ref: "shadow.layered", count: 3 }],
    "circular-reference": [{ chain: ["color.a", "color.b", "color.a"] }],
    "type-mismatch": [{ ref: "space.md", expected: "color", found: "dimension" }],
    "whitespace-in-name": [{ name: "brand " }],
    "unknown-property": [
        { property: "colour", owner: "resolver" },
        { property: "descripton", owner: "set" },
        { property: "defualt", owner: "modifier" },
        { property: "paragraphSpacing", owner: "typography", at: ["$value", "paragraphSpacing"] },
        { property: "fluid", owner: "dimension", at: ["$value", "width", "fluid"] },
    ],
    "permutation-limit": [{ count: 16384, limit: 64, built: 15 }],
    "no-default": [{ modifiers: ["size"] }, { modifiers: ["size", "theme"] }],
    "deprecated-reference": [{ ref: "color.old" }, { ref: "color.old", reason: "use color.brand" }],
};

const messages = (Object.keys(examples) as DiagnosticKind[]).flatMap((kind) =>
    examples[kind].map((detail) => ({
        kind,
        message: (diagnosticMessages[kind].message as (detail: unknown) => string)(detail),
    })),
);

describe("diagnostic messages", () => {
    it("has an entry for every kind", () => {
        expect(Object.keys(diagnosticMessages).sort()).toStrictEqual(Object.keys(examples).sort());
    });

    it("has an example for every reason a value is not valid", () => {
        const reasons = new Set(examples["invalid-value"].map(({ reason }) => reason));
        expect([...reasons].sort()).toStrictEqual(Object.keys(valueErrorMessages).sort());
    });

    it.for(messages)("words $kind as plain text: $message", ({ message }) => {
        expect(message).not.toBe("");
        expect(message).toMatch(/^[^A-Z]/);
        expect(message).not.toMatch(/\.$/);
        expect(message).not.toMatch(/(^|\s)(sugarcube|npx|pnpm|npm)\s|\s--?[a-z]/);
        expect(message).not.toMatch(/did you mean/i);
    });
});

describe("diagnostic messages from read", () => {
    const stepsGenerator = defineGenerator({
        extension: ["com.example", "steps"],
        messages: {
            "not-a-count": ({ steps }: { steps: unknown }) =>
                `\`steps\` must be a whole number above 0, not ${JSON.stringify(steps)}`,
        },
        generate: (_group, extension) => ({
            ok: false,
            errors: [{ path: [], reason: "not-a-count", data: { steps: extension } }],
        }),
    });

    function diagnostics(generator: Generator) {
        const text = JSON.stringify({
            space: { $type: "dimension", $extensions: { "com.example": { steps: "three" } } },
        });
        return readFromMemory({ files: { "tokens.json": text } }, { generators: [generator] })
            .diagnostics;
    }

    it("words extension-invalid from the generator's messages", () => {
        expect(diagnostics(stepsGenerator).map(({ message }) => message)).toStrictEqual([
            '`steps` must be a whole number above 0, not "three"',
        ]);
    });

    it("falls back to its own wording for a reason the generator has no message for", () => {
        const unworded: Generator = { ...stepsGenerator, messages: {} };
        expect(diagnostics(unworded).map(({ message }) => message)).toStrictEqual([
            "the `com.example` extension is not valid",
        ]);
    });

    it("falls back for a reason named like a property every object has", () => {
        const inherited: Generator = {
            extension: ["com.example", "steps"],
            messages: {},
            generate: () => ({ ok: false, errors: [{ path: [], reason: "toString" }] }),
        };
        expect(diagnostics(inherited).map(({ message }) => message)).toStrictEqual([
            "the `com.example` extension is not valid",
        ]);
    });

    it("words a schema's issue with the library's message", () => {
        const counted = defineGenerator({
            extension: ["com.example", "steps"],
            schema: {
                "~standard": {
                    version: 1,
                    vendor: "test",
                    validate: () => ({ issues: [{ message: "Expected number, received string" }] }),
                },
            },
            generate: () => ({ ok: true, value: [] }),
        });
        expect(diagnostics(counted).map(({ message }) => message)).toStrictEqual([
            "Expected number, received string",
        ]);
    });

    it("links invalid-value to the section for its reason", () => {
        const text = JSON.stringify({ space: { $type: "dimension", $value: "16px" } });
        const doc = readFromMemory({ files: { "tokens.json": text } });
        expect(doc.diagnostics.map(({ docs }) => docs)).toStrictEqual([
            "https://sugarcube.sh/errors/invalid-value#string-with-unit",
        ]);
    });
});
