import { describe, expect, it } from "vitest";
import { diagnosticMessages } from "../../src/error-messages.js";
import {
    type DiagnosticDetailByKind,
    type DiagnosticKind,
    type Generator,
    defineGenerator,
} from "../../src/index.js";
import { oneFile } from "../token-files.js";
import { valueErrorMessages } from "../../src/values/value-errors.js";
import { dimensionUnits, durationUnits, lineCaps, strokeStyleKeywords } from "../../src/values.js";

type Example<K extends DiagnosticKind> = DiagnosticDetailByKind[K] & {
    message?: string;
    help?: string;
};

const examples: { [K in DiagnosticKind]: Example<K>[] } = {
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
        { rule: "version", name: "version", jsonPath: ["version"] },
        { rule: "missing-property", name: "sources", jsonPath: ["sets", "base"] },
        {
            rule: "wrong-type",
            name: "sources",
            jsonPath: ["sets", "base", "sources"],
            expected: "array",
        },
        { rule: "unknown-item-type", name: "group", jsonPath: ["resolutionOrder", 0, "type"] },
        {
            rule: "resolver-as-source",
            name: "other.resolver.json",
            jsonPath: ["sets", "base", "sources", 0],
        },
        { rule: "unknown-set", name: "base", jsonPath: ["resolutionOrder", 0, "$ref"] },
        { rule: "unknown-modifier", name: "theme", jsonPath: ["resolutionOrder", 1, "$ref"] },
        {
            rule: "invalid-pointer",
            name: "#/modifiers/theme",
            jsonPath: ["sets", "base", "sources", 0],
        },
        {
            rule: "circular-reference",
            name: "#/sets/base",
            jsonPath: ["sets", "base", "sources", 0],
        },
        { rule: "duplicate-name", name: "base", jsonPath: ["resolutionOrder", 1, "name"] },
        { rule: "no-contexts", name: "theme", jsonPath: ["modifiers", "theme", "contexts"] },
        { rule: "single-context", name: "theme", jsonPath: ["modifiers", "theme", "contexts"] },
        { rule: "empty-resolution-order", name: "resolutionOrder", jsonPath: ["resolutionOrder"] },
        { rule: "invalid-default", name: "theme", jsonPath: ["modifiers", "theme", "default"] },
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
        {
            reason: "missing-modifier",
            input: 0,
            modifier: "theme",
            valid: ["light", "dark"],
            message: "no context chosen for `theme`",
            help: "choose `light` or `dark`",
        },
        {
            reason: "missing-modifier",
            input: 0,
            modifier: "theme",
            valid: ["light", "dark", "dim"],
            message: "no context chosen for `theme`",
            help: "choose `light`, `dark` or `dim`",
        },
        { reason: "not-a-string", input: 0, modifier: "beta" },
    ],
    "invalid-name": [
        { name: "$brand", character: "$" },
        { name: "a.b", character: "." },
        { name: "", message: "a name can't be empty" },
    ],
    "token-and-group": [
        {
            reason: "child",
            child: "light",
            found: "object",
            message: "a token can't contain other tokens",
        },
        {
            reason: "child",
            child: "alpha",
            found: "number",
            message: "`alpha` is not a token property",
        },
        {
            reason: "declared",
            declaredAs: "token",
            path: "color.blue",
            otherFiles: ["dark.json"],
            message: "`color.blue` is a group in `dark.json`",
        },
        {
            reason: "declared",
            declaredAs: "group",
            path: "color.blue",
            otherFiles: ["base.json", "brand.json"],
            message: "`color.blue` is a token in `base.json` and `brand.json`",
        },
        { reason: "ref", ref: "#/base" },
    ],
    "invalid-member": [
        { name: "brand", found: "string" },
        { name: "sizes", found: "array" },
    ],
    "invalid-property": [
        { property: "$description", expected: "string" },
        { property: "$deprecated", expected: "boolean-or-string" },
        { property: "$extensions", expected: "object" },
        { property: "$extends", expected: "reference" },
        {
            property: "$extends",
            expected: "reference",
            reference: "{base}",
            message: "`$extends` must be a reference",
            help: "did you mean `{base}`?",
        },
    ],
    "missing-type": [{}],
    "unknown-type": [
        { type: "colour" },
        {
            type: "colour",
            similar: "color",
            message: "`colour` is not a token type",
            help: "did you mean `color`?",
        },
        { type: "" },
    ],
    "invalid-value": [
        { jsonPath: ["$value"], type: "dimension", reason: "wrong-shape", value: 16 },
        {
            jsonPath: ["$value"],
            type: "color",
            reason: "wrong-shape",
            value: "color.ink",
            reference: "{color.ink}",
            message: "a color can't be a string",
            help: "did you mean `{color.ink}`?",
        },
        { jsonPath: ["$value"], type: "shadow", reason: "wrong-shape", value: "0 1px 2px black" },
        { jsonPath: ["$value"], type: "typography", reason: "wrong-shape", value: [] },
        {
            jsonPath: ["$value", "blurr"],
            type: "shadow",
            reason: "unknown-property",
            property: "blurr",
        },
        { jsonPath: ["$value", "$ref"], type: "color", reason: "pointer-not-alone" },
        {
            jsonPath: ["$value", "blur"],
            type: "shadow",
            reason: "missing-property",
            property: "blur",
        },
        { jsonPath: ["$value", "value"], type: "dimension", reason: "not-a-number", value: "16" },
        { jsonPath: ["$value", "value"], type: "dimension", reason: "not-a-number", value: null },
        {
            jsonPath: ["$value", 0],
            type: "fontFamily",
            reason: "curly-brace-not-allowed-here",
            reference: "{font.brand}",
        },
        {
            jsonPath: ["$value"],
            type: "color",
            reason: "hex-string",
            value: "#e11d48",
            asObject: { colorSpace: "srgb", components: [0.8824, 0.1137, 0.2824], hex: "#e11d48" },
        },
        {
            jsonPath: ["$value", "colorSpace"],
            type: "color",
            reason: "unknown-color-space",
            value: "rgb",
        },
        {
            jsonPath: ["$value", "colorSpace"],
            type: "color",
            reason: "unknown-color-space",
            value: 5,
        },
        {
            jsonPath: ["$value", "components"],
            type: "color",
            reason: "not-three-components",
            value: [1, 0, 0, 1],
        },
        {
            jsonPath: ["$value", "components"],
            type: "color",
            reason: "not-three-components",
            value: "1 0 0",
        },
        {
            jsonPath: ["$value", "components", 1],
            type: "color",
            reason: "component-not-a-number",
            value: "0.5",
        },
        {
            jsonPath: ["$value", "components", 2],
            type: "color",
            reason: "component-out-of-range",
            value: 400,
            colorSpace: "oklch",
            component: "Hue",
            min: 0,
            max: 360,
            maxExclusive: true,
        },
        {
            jsonPath: ["$value", "components", 0],
            type: "color",
            reason: "component-out-of-range",
            value: 1.1,
            colorSpace: "srgb",
            component: "Red",
            min: 0,
            max: 1,
            maxExclusive: false,
        },
        {
            jsonPath: ["$value", "components", 1],
            type: "color",
            reason: "component-out-of-range",
            value: -0.1,
            colorSpace: "oklch",
            component: "Chroma",
            min: 0,
            maxExclusive: false,
        },
        { jsonPath: ["$value", "alpha"], type: "color", reason: "alpha-out-of-range", value: 1.5 },
        {
            jsonPath: ["$value", "hex"],
            type: "color",
            reason: "hex-not-six-digits",
            value: "#e1d",
            sixDigits: "#ee11dd",
            message: "`hex` must have six digits",
            help: "write `#ee11dd`",
        },
        {
            jsonPath: ["$value", "hex"],
            type: "color",
            reason: "hex-not-six-digits",
            value: "#e1dd",
        },
        {
            jsonPath: ["$value"],
            type: "color",
            reason: "short-hex-string",
            value: "#e1d",
            expanded: "#ee11dd",
            message: "a hex color needs six digits",
            help: "write `#ee11dd`",
        },
        {
            jsonPath: ["$value"],
            type: "color",
            reason: "short-hex-string",
            value: "#e1d8",
            expanded: "#ee11dd88",
            message: "a hex color needs eight digits",
            help: "write `#ee11dd88`",
        },
        {
            jsonPath: ["$value", "hex"],
            type: "color",
            reason: "hex-not-six-digits",
            value: 16711680,
        },
        {
            jsonPath: ["$value"],
            type: "dimension",
            reason: "string-with-unit",
            value: "16px",
            unit: "px",
            allowed: dimensionUnits,
            asObject: { value: 16, unit: "px" },
            message: "a dimension can't be a string",
            help: 'write `{ "value": 16, "unit": "px" }`',
        },
        {
            jsonPath: ["$value"],
            type: "dimension",
            reason: "string-with-unit",
            value: "16em",
            unit: "em",
            allowed: dimensionUnits,
            message: "`em` is not a dimension unit",
            help: "use `px` or `rem`",
        },
        {
            jsonPath: ["$value"],
            type: "duration",
            reason: "string-with-unit",
            value: "200ms",
            unit: "ms",
            allowed: durationUnits,
            asObject: { value: 200, unit: "ms" },
        },
        { jsonPath: ["$value"], type: "cubicBezier", reason: "not-four-numbers", count: 3 },
        {
            jsonPath: ["$value", 0],
            type: "cubicBezier",
            reason: "x-out-of-range",
            value: 1.2,
            coordinate: "x1",
        },
        { jsonPath: ["$value"], type: "fontFamily", reason: "empty-font-list" },
        { jsonPath: ["$value", 1], type: "fontFamily", reason: "not-a-font-name", value: 4 },
        { jsonPath: ["$value"], type: "fontFamily", reason: "not-a-font-name", value: "  " },
        {
            jsonPath: ["$value"],
            type: "strokeStyle",
            reason: "unknown-stroke-style-keyword",
            value: "thick",
            keywords: strokeStyleKeywords,
        },
        {
            jsonPath: ["$value", "dashArray"],
            type: "strokeStyle",
            reason: "dash-array-not-a-list",
            value: "4px 2px",
        },
        { jsonPath: ["$value", "dashArray"], type: "strokeStyle", reason: "empty-dash-array" },
        {
            jsonPath: ["$value", "lineCap"],
            type: "strokeStyle",
            reason: "unknown-line-cap",
            value: "flat",
            lineCaps,
        },
        { jsonPath: ["$value"], type: "shadow", reason: "no-shadows" },
        { jsonPath: ["$value"], type: "gradient", reason: "no-gradient-stops" },
        { jsonPath: ["$value", "inset"], type: "shadow", reason: "not-a-boolean", value: "yes" },
        {
            jsonPath: ["$value"],
            type: "fontWeight",
            reason: "font-weight-out-of-range",
            value: 1200,
        },
        {
            jsonPath: ["$value"],
            type: "fontWeight",
            reason: "unknown-font-weight-keyword",
            value: "Bold",
        },
        {
            jsonPath: ["$value"],
            type: "fontWeight",
            reason: "unknown-font-weight-keyword",
            value: "heavyweight",
        },
        {
            jsonPath: ["base", "min"],
            type: "dimension",
            reason: "reference-not-allowed",
            reference: "{space.md}",
        },
        {
            jsonPath: ["$value", "unit"],
            type: "dimension",
            reason: "unit-not-allowed",
            unit: "em",
            allowed: dimensionUnits,
        },
        {
            jsonPath: ["$value", "unit"],
            type: "duration",
            reason: "unit-not-allowed",
            unit: 5,
            allowed: durationUnits,
        },
    ],
    "hex-string-color": [
        {
            value: "#e11d48",
            asObject: { colorSpace: "srgb", components: [0.8824, 0.1137, 0.2824], hex: "#e11d48" },
        },
    ],
    "extension-invalid": [
        { key: "sh.sugarcube", jsonPath: ["$extensions", "sh.sugarcube", "scale", "mode"] },
        {
            key: "sh.sugarcube",
            jsonPath: ["$extensions", "sh.sugarcube", "scale", "ratio", "min"],
            reason: "ratio-not-above-one",
            data: { ratio: 1 },
        },
    ],
    "overridden-by-generator": [
        {
            path: "size.step.3",
            from: "size.step",
            extension: ["sh.sugarcube", "scale"],
            declaredAs: "token",
        },
        {
            path: "md",
            from: "",
            extension: ["sh.sugarcube", "scale"],
            declaredAs: "group",
            message: "`md` is made by `sh.sugarcube.scale` on the top level",
        },
    ],
    "missing-reference": [
        { ref: "color.brnad", from: ["color.danger"] },
        { ref: "color.brnad", from: ["color.danger"], similar: "color.brand" },
        {
            ref: "color.inc",
            from: ["color.muted"],
            similar: "color.ink",
            message: "`color.inc` does not exist",
            help: "did you mean `color.ink`?",
        },
        {
            ref: "#/color/inc/$value",
            from: ["color.muted"],
            similar: "#/color/ink/$value",
        },
    ],
    "not-a-group": [{ ref: "color.brand" }],
    "malformed-pointer": [
        {
            ref: "#color/ink",
            reason: "no-leading-slash",
            suggestion: "#/color/ink",
            message: "`#color/ink` is not a JSON Pointer",
            help: "write `#/color/ink`",
        },
        { ref: "#missing/$value", reason: "no-leading-slash" },
        { ref: "#/a~b/$value", reason: "bad-escape", suggestion: "#/a~0b/$value" },
        {
            ref: "#/a~b",
            reason: "bad-escape",
            suggestion: "#/a~0b",
            message: "`~` and `/` must be escaped",
            help: "write `#/a~0b`",
        },
        { ref: "all.json#color", reason: "no-leading-slash", suggestion: "all.json#/color" },
    ],
    "not-a-token": [{ ref: "color.accent" }],
    "not-a-value": [
        {
            ref: "#/base",
            suggestion: "#/base/$value",
            message: "a `$ref` must point at a value",
            help: "write `#/base/$value`",
        },
    ],
    "ref-and-value": [{}],
    "reference-to-several": [{ ref: "shadow.layered", count: 3 }],
    "circular-reference": [{ chain: ["color.a", "color.b", "color.a"] }],
    "type-mismatch": [{ ref: "space.md", expected: "color", found: "dimension" }],
    "whitespace-in-name": [{ name: "brand " }],
    "unknown-property": [
        { property: "colour", owner: "resolver" },
        { property: "descripton", owner: "set" },
        {
            property: "descripton",
            owner: "set",
            similar: "description",
            message: "`descripton` is not a set property",
            help: "did you mean `description`?",
        },
        { property: "defualt", owner: "modifier" },
        { property: "$whatever", owner: "token" },
        { property: "$metadata", owner: "group", ignored: true },
        {
            property: "owner",
            owner: "resolver",
            message: "`owner` is not a resolver property",
        },
        {
            property: "paragraphSpacing",
            type: "typography",
            jsonPath: ["$value", "paragraphSpacing"],
        },
        { property: "fluid", type: "dimension", jsonPath: ["$value", "width", "fluid"] },
    ],
    "misspelt-property": [
        {
            key: "value",
            property: "$value",
            owner: "token",
            message: "`value` is not a token property",
            help: "did you mean `$value`?",
        },
        { key: "type", property: "$type", owner: "group" },
        { key: "$tpye", property: "$type", owner: "group" },
    ],
    "permutation-limit": [
        { count: 16384, limit: 64, built: 15 },
        {
            count: 64,
            limit: 32,
            built: 7,
            message: "too many combinations: 64, over the limit of 32",
        },
    ],
    "not-in-resolution-order": [
        { item: "set", name: "palette" },
        { item: "modifier", name: "density" },
    ],
    "deprecated-reference": [
        { ref: "color.old", message: "`color.old` is deprecated" },
        {
            ref: "color.old",
            reason: "use color.brand",
            message: "`color.old` is deprecated: use color.brand",
        },
    ],
};

type Words = (detail: unknown) => string | undefined;

const messages = (Object.keys(examples) as DiagnosticKind[]).flatMap((kind) =>
    (examples[kind] as { message?: string; help?: string }[]).map(
        ({ message: expected, help: expectedHelp, ...detail }) => ({
            kind: "reason" in detail ? `${kind}, ${String(detail.reason)}` : kind,
            message: (diagnosticMessages[kind].message as Words)(detail),
            help: (diagnosticMessages[kind].help as Words | undefined)?.(detail),
            expected,
            expectedHelp,
        }),
    ),
);

describe("diagnostic messages", () => {
    it("has an entry for every kind", () => {
        expect(Object.keys(diagnosticMessages).sort()).toStrictEqual(Object.keys(examples).sort());
    });

    it("has an example for every reason a value is not valid", () => {
        const reasons = new Set(examples["invalid-value"].map(({ reason }) => reason));
        expect([...reasons].sort()).toStrictEqual(Object.keys(valueErrorMessages).sort());
    });

    it.for(messages)("words $kind as plain text: $message", ({ message, help }) => {
        for (const words of [message, help ?? "x"]) {
            expect(words).not.toBe("");
            expect(words).toMatch(/^[^A-Z]/);
            expect(words).not.toMatch(/\.$/);
            expect(words).not.toMatch(/(^|\s)(sugarcube|npx|pnpm|npm)\s|\s--?[a-z]/);
        }
    });

    it.for(messages.filter(({ expected }) => expected !== undefined))(
        "words $kind exactly: $expected",
        ({ message, help, expected, expectedHelp }) => {
            expect({ message, help }).toStrictEqual({ message: expected, help: expectedHelp });
        },
    );

    it("makes a property set aside a warning", () => {
        const { severity } = diagnosticMessages["unknown-property"];
        const detail = { property: "$metadata", owner: "group", ignored: true } as const;
        expect(typeof severity === "function" && severity(detail)).toBe("warning");
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
            errors: [{ jsonPath: [], reason: "not-a-count", data: { steps: extension } }],
        }),
    });

    function messagesFrom(generator: Generator) {
        return oneFile(
            { space: { $type: "dimension", $extensions: { "com.example": { steps: "three" } } } },
            { generators: [generator] },
        ).diagnostics.map(({ message }) => message);
    }

    it("words extension-invalid from the generator's messages", () => {
        expect(messagesFrom(stepsGenerator)).toStrictEqual([
            '`steps` must be a whole number above 0, not "three"',
        ]);
    });

    it("takes a fix from a generator's message, when it gives one", () => {
        const helped = defineGenerator({
            extension: ["com.example", "steps"],
            messages: {
                "not-a-count": ({ steps }: { steps: unknown }) => ({
                    message: `\`${JSON.stringify(steps)}\` is not a count`,
                    help: "use a whole number above 0",
                }),
            },
            generate: (_group, extension) => ({
                ok: false,
                errors: [{ jsonPath: [], reason: "not-a-count", data: { steps: extension } }],
            }),
        });
        const [problem] = oneFile(
            { space: { $type: "dimension", $extensions: { "com.example": { steps: "three" } } } },
            { generators: [helped] },
        ).diagnostics;
        expect([problem?.message, problem?.help]).toStrictEqual([
            '`"three"` is not a count',
            "use a whole number above 0",
        ]);
    });

    it("falls back to its own wording for a reason the generator has no message for", () => {
        const unworded: Generator = { ...stepsGenerator, messages: {} };
        expect(messagesFrom(unworded)).toStrictEqual(["invalid `com.example` extension"]);
    });

    it("falls back for a reason named like a property every object has", () => {
        const inherited: Generator = {
            extension: ["com.example", "steps"],
            messages: {},
            generate: () => ({ ok: false, errors: [{ jsonPath: [], reason: "toString" }] }),
        };
        expect(messagesFrom(inherited)).toStrictEqual(["invalid `com.example` extension"]);
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
        expect(messagesFrom(counted)).toStrictEqual(["Expected number, received string"]);
    });

    it("links invalid-value to the section for its reason", () => {
        const tokens = oneFile({ space: { $type: "dimension", $value: "16px" } });
        expect(tokens.diagnostics.map(({ docsUrl }) => docsUrl)).toStrictEqual([
            "https://sugarcube.sh/errors/invalid-value#string-with-unit",
        ]);
    });
});
