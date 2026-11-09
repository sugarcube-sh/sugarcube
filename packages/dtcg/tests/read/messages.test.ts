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

type Example<K extends DiagnosticKind> = DiagnosticDetailByKind[K] & { message?: string };

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
            message:
                "the input doesn't choose a context for the modifier `theme`, which has no default: choose `light` or `dark`",
        },
        {
            reason: "missing-modifier",
            input: 0,
            modifier: "theme",
            valid: ["light", "dark", "dim"],
            message:
                "the input doesn't choose a context for the modifier `theme`, which has no default: choose `light`, `dark` or `dim`",
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
            message:
                "`light` is inside a token (it has a `$value`), and a token cannot hold tokens or groups",
        },
        {
            reason: "declared",
            here: "token",
            message: "this is a token here but a group in another file",
        },
        {
            reason: "declared",
            here: "group",
            message: "this is a group here but a token in another file",
        },
        {
            reason: "ref",
            ref: "#/base",
            message:
                "this has a `$ref`, which makes it a token, and a token cannot hold tokens or groups; to extend a group, use `$extends`",
        },
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
            message:
                '`$extends` must be a reference, such as "{group}" or { "$ref": "#/group" }; did you mean `{base}`?',
        },
    ],
    "missing-type": [{}],
    "unknown-type": [
        { type: "colour" },
        {
            type: "colour",
            similar: "color",
            message: "`colour` is not a token type; did you mean `color`?",
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
            message:
                "a color must be an object with `colorSpace` and `components`, not the string `color.ink`; did you mean `{color.ink}`?",
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
            component: "H",
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
            component: "R",
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
            component: "C",
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
            message: "`#e1d` is not a six-digit hex color; did you mean `#ee11dd`?",
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
            message: "`#e1d` is not a six-digit hex color; did you mean `#ee11dd`?",
        },
        {
            jsonPath: ["$value"],
            type: "color",
            reason: "short-hex-string",
            value: "#e1d8",
            expanded: "#ee11dd88",
            message: "`#e1d8` is not an eight-digit hex color; did you mean `#ee11dd88`?",
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
            asObject: { value: 16, unit: "px" },
            message:
                '`16px` is a string, and a dimension must be an object with a value and a unit, such as `{ "value": 16, "unit": "px" }`',
        },
        {
            jsonPath: ["$value"],
            type: "dimension",
            reason: "string-with-unit",
            value: "16em",
            message:
                "`16em` is a string, and a dimension must be an object with a value and a unit",
        },
        {
            jsonPath: ["$value"],
            type: "duration",
            reason: "string-with-unit",
            value: "200ms",
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
    "written-generated": [
        {
            path: "size.step.3",
            from: "size.step",
            extension: ["sh.sugarcube", "scale"],
            written: "token",
        },
        {
            path: "md",
            from: "",
            extension: ["sh.sugarcube", "scale"],
            written: "group",
            message:
                "`md` is made by `sh.sugarcube.scale` on the top level, so the group written here is not used; change the extension instead",
        },
    ],
    "missing-reference": [
        { ref: "color.brnad", from: ["color.danger"] },
        { ref: "color.brnad", from: ["color.danger"], similar: "color.brand" },
        {
            ref: "color.inc",
            from: ["color.muted"],
            similar: "color.ink",
            message: "`color.inc` does not exist; did you mean `color.ink`?",
        },
        {
            ref: "#/color/inc/$value",
            from: ["color.muted"],
            similar: "#/color/ink/$value",
            message: "`#/color/inc/$value` does not exist; did you mean `#/color/ink/$value`?",
        },
    ],
    "not-a-group": [{ ref: "color.brand" }],
    "malformed-pointer": [
        {
            ref: "#color/ink",
            reason: "no-leading-slash",
            corrected: "#/color/ink",
            message:
                "`#color/ink` is not a JSON Pointer, which starts with `#/`; write it as `#/color/ink`",
        },
        { ref: "#missing/$value", reason: "no-leading-slash" },
        { ref: "#/a~b/$value", reason: "bad-escape", corrected: "#/a~0b/$value" },
        {
            ref: "#/a~b",
            reason: "bad-escape",
            corrected: "#/a~0b",
            message:
                "`#/a~b` is not a JSON Pointer: in one, `~` is written `~0` and `/` is written `~1`; write it as `#/a~0b`",
        },
        { ref: "all.json#color", reason: "no-leading-slash", corrected: "all.json#/color" },
    ],
    "not-a-token": [{ ref: "color.accent" }],
    "not-a-value": [
        {
            ref: "#/base",
            corrected: "#/base/$value",
            message: "`#/base` reaches a token, not its value; write it as `#/base/$value`",
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
            message: "`descripton` is not a property of a set; did you mean `description`?",
        },
        { property: "defualt", owner: "modifier" },
        {
            property: "$whatever",
            owner: "token",
            message: "`$whatever` is not a property of a token: put your own data in `$extensions`",
        },
        {
            property: "$whatever",
            owner: "group",
            message: "`$whatever` is not a property of a group: put your own data in `$extensions`",
        },
        {
            property: "owner",
            owner: "set",
            message: "`owner` is not a property of a set: put your own data in `$extensions`",
        },
        {
            property: "$extends",
            owner: "token",
            message: "`$extends` is not a property of a token",
        },
        { property: "$value", owner: "group", message: "`$value` is not a property of a group" },
        {
            property: "$metadata",
            owner: "group",
            ignored: true,
            message: "`$metadata` is not a property of a group, so it is ignored",
        },
        {
            property: "owner",
            owner: "resolver",
            message: "`owner` is not a property of the resolver",
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
            written: "value",
            property: "$value",
            owner: "token",
            message: "`value` is not a token property; did you mean `$value`?",
        },
        { written: "type", property: "$type", owner: "group" },
        {
            written: "$tpye",
            property: "$type",
            owner: "group",
            message: "`$tpye` is not a group property; did you mean `$type`?",
        },
    ],
    "permutation-limit": [
        { count: 16384, limit: 64, built: 15 },
        {
            count: 64,
            limit: 32,
            built: 7,
            message:
                "the modifiers make 64 combinations, more than the limit of 32, so each context was built on its own instead: 7 permutations",
        },
        {
            count: 64,
            limit: 32,
            built: 1,
            message:
                "the modifiers make 64 combinations, more than the limit of 32, so each context was built on its own instead: 1 permutation",
        },
    ],
    "not-in-resolution-order": [
        { item: "set", name: "palette" },
        { item: "modifier", name: "density" },
    ],
    "deprecated-reference": [{ ref: "color.old" }, { ref: "color.old", reason: "use color.brand" }],
};

const messages = (Object.keys(examples) as DiagnosticKind[]).flatMap((kind) =>
    examples[kind].map(({ message: expected, ...detail }: Example<DiagnosticKind>) => ({
        kind: "reason" in detail ? `${kind}, ${String(detail.reason)}` : kind,
        message: (diagnosticMessages[kind].message as (detail: unknown) => string)(detail),
        expected,
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
    });

    it.for(messages.filter(({ expected }) => expected !== undefined))(
        "words $kind exactly: $expected",
        ({ message, expected }) => {
            expect(message).toBe(expected);
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

    function diagnostics(generator: Generator) {
        return oneFile(
            { space: { $type: "dimension", $extensions: { "com.example": { steps: "three" } } } },
            { generators: [generator] },
        ).diagnostics;
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
            generate: () => ({ ok: false, errors: [{ jsonPath: [], reason: "toString" }] }),
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
        const tokens = oneFile({ space: { $type: "dimension", $value: "16px" } });
        expect(tokens.diagnostics.map(({ docsUrl }) => docsUrl)).toStrictEqual([
            "https://sugarcube.sh/errors/invalid-value#string-with-unit",
        ]);
    });
});
