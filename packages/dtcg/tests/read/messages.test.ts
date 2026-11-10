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

type Facts<K extends DiagnosticKind> =
    DiagnosticDetailByKind[K] extends Record<string, never> ? unknown : DiagnosticDetailByKind[K];

type Example<K extends DiagnosticKind> = Facts<K> & {
    message: string;
    help?: string;
};

const examples: { [K in DiagnosticKind]: Example<K>[] } = {
    "file-not-found": [
        { file: "dark.json", message: "can't read `dark.json`" },
        {
            file: "dark.json",
            referencedFrom: "tokens.resolver.json",
            message: "can't read `dark.json`",
        },
    ],
    "invalid-json": [
        { reason: "comment", message: "comments aren't allowed" },
        { reason: "trailing-comma", message: "trailing commas aren't allowed" },
        { reason: "not-an-object", message: "the top level must be an object" },
        { reason: "comma-expected", message: "`,` expected" },
        { reason: "close-brace-expected", message: "`}` expected" },
        { reason: "unexpected-end-of-string", message: "unclosed string" },
    ],
    "duplicate-key": [{ key: "brand", message: "duplicate key `brand`" }],
    "resolver-invalid": [
        {
            rule: "version",
            name: "version",
            jsonPath: ["version"],
            message: '`version` must be "2025.10"',
        },
        {
            rule: "missing-property",
            name: "sources",
            jsonPath: ["sets", "base"],
            message: "`sources` is missing",
        },
        {
            rule: "wrong-type",
            name: "sources",
            jsonPath: ["sets", "base", "sources"],
            expected: "array",
            message: "`sources` must be a list",
        },
        {
            rule: "unknown-item-type",
            name: "group",
            jsonPath: ["resolutionOrder", 0, "type"],
            message: "`group` is not an item type",
            help: 'use "set" or "modifier"',
        },
        {
            rule: "resolver-as-source",
            name: "other.resolver.json",
            jsonPath: ["sets", "base", "sources", 0],
            message: "`other.resolver.json` is a resolver, not a token file",
        },
        {
            rule: "unknown-set",
            name: "base",
            jsonPath: ["resolutionOrder", 0, "$ref"],
            message: "no set named `base`",
        },
        {
            rule: "unknown-modifier",
            name: "theme",
            jsonPath: ["resolutionOrder", 1, "$ref"],
            message: "no modifier named `theme`",
        },
        {
            rule: "invalid-pointer",
            name: "#/modifiers/theme",
            jsonPath: ["sets", "base", "sources", 0],
            message: "can't refer to `#/modifiers/theme` from here",
        },
        {
            rule: "circular-reference",
            name: "#/sets/base",
            jsonPath: ["sets", "base", "sources", 0],
            message: "`#/sets/base` leads back to itself",
        },
        {
            rule: "duplicate-name",
            name: "base",
            jsonPath: ["resolutionOrder", 1, "name"],
            message: "duplicate name `base`",
        },
        {
            rule: "no-contexts",
            name: "theme",
            jsonPath: ["modifiers", "theme", "contexts"],
            message: "`theme` has no contexts",
        },
        {
            rule: "single-context",
            name: "theme",
            jsonPath: ["modifiers", "theme", "contexts"],
            message: "`theme` has only one context",
        },
        {
            rule: "empty-resolution-order",
            name: "resolutionOrder",
            jsonPath: ["resolutionOrder"],
            message: "`resolutionOrder` is empty",
        },
        {
            rule: "invalid-default",
            name: "theme",
            jsonPath: ["modifiers", "theme", "default"],
            message: "`theme`'s default isn't one of its contexts",
        },
        {
            rule: "file-in-resolution-order",
            name: "base.json",
            jsonPath: ["resolutionOrder", 0],
            message: "`base.json` is a file, not a set or modifier",
        },
    ],
    "input-invalid": [
        {
            reason: "unknown-modifier",
            input: 0,
            modifier: "size",
            valid: ["theme"],
            message: "no modifier named `size`",
        },
        {
            reason: "unknown-context",
            input: 0,
            modifier: "theme",
            context: "blue",
            valid: ["light", "dark"],
            message: "`blue` is not a context of `theme`",
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
        {
            reason: "not-a-string",
            input: 0,
            modifier: "beta",
            message: "the input for `beta` must be a string",
        },
    ],
    "invalid-name": [
        { name: "$brand", character: "$", message: "a name can't start with `$`" },
        { name: "a.b", character: ".", message: "a name can't contain `.`" },
        { name: "", message: "a name can't be empty" },
    ],
    "token-and-group": [
        {
            reason: "child",
            child: "alpha",
            found: "number",
            message: "`alpha` is not a token property",
        },
        {
            reason: "child",
            child: "light",
            found: "object",
            message: "a token can't contain other tokens",
        },
        {
            reason: "declared",
            here: "token",
            path: "color.ink",
            otherFiles: ["dark.json"],
            message: "`color.ink` is a group in `dark.json`",
        },
        {
            reason: "declared",
            here: "group",
            path: "color.ink",
            otherFiles: ["base.json"],
            message: "`color.ink` is a token in `base.json`",
        },
        {
            reason: "declared",
            here: "group",
            path: "color.ink",
            otherFiles: ["base.json", "brand.json"],
            message: "`color.ink` is a token in `base.json` and `brand.json`",
        },
        {
            reason: "ref",
            ref: "#/base",
            message: "`$ref` doesn't extend a group",
        },
    ],
    "invalid-member": [
        { name: "brand", found: "string", message: "`brand` is not a token or group" },
        { name: "sizes", found: "array", message: "`sizes` is not a token or group" },
    ],
    "invalid-property": [
        {
            property: "$description",
            expected: "string",
            message: "`$description` must be a string",
        },
        {
            property: "$deprecated",
            expected: "boolean-or-string",
            message: "`$deprecated` must be true, false or a string",
        },
        {
            property: "$extensions",
            expected: "object",
            message: "`$extensions` must be an object",
        },
        {
            property: "$extends",
            expected: "reference",
            message: "`$extends` must be a reference",
        },
        {
            property: "$extends",
            expected: "reference",
            reference: "{base}",
            message: "`$extends` must be a reference",
            help: "did you mean `{base}`?",
        },
    ],
    "missing-type": [{ message: "no `$type`" }],
    "unknown-type": [
        { type: "colour", message: "`colour` is not a token type" },
        {
            type: "colour",
            similar: "color",
            message: "`colour` is not a token type",
            help: "did you mean `color`?",
        },
        { type: "", message: "`$type` is empty" },
    ],
    "invalid-value": [
        {
            jsonPath: ["$value"],
            type: "dimension",
            reason: "wrong-shape",
            value: 16,
            message: "a dimension can't be a number",
            help: "write an object with a value and a unit",
        },
        {
            jsonPath: ["$value"],
            type: "color",
            reason: "wrong-shape",
            value: "color.ink",
            reference: "{color.ink}",
            message: "a color can't be a string",
            help: "did you mean `{color.ink}`?",
        },
        {
            jsonPath: ["$value"],
            type: "shadow",
            reason: "wrong-shape",
            value: "0 1px 2px black",
            message: "a shadow can't be a string",
            help: "write an object with `color`, `offsetX`, `offsetY`, `blur` and `spread`, or a list of them",
        },
        {
            jsonPath: ["$value"],
            type: "typography",
            reason: "wrong-shape",
            value: [],
            message: "a typography value can't be a list",
            help: "write an object with `fontFamily`, `fontSize`, `fontWeight`, `letterSpacing` and `lineHeight`",
        },
        {
            jsonPath: ["$value"],
            type: "number",
            reason: "wrong-shape",
            value: true,
            message: "a number can't be `true`",
            help: "write a number",
        },
        {
            jsonPath: ["$value", "blurr"],
            type: "shadow",
            reason: "unknown-property",
            property: "blurr",
            message: "`blurr` is not a shadow property",
        },
        {
            jsonPath: ["$value", "$ref"],
            type: "color",
            reason: "pointer-not-alone",
            message: "`$ref` can't have other properties beside it",
        },
        {
            jsonPath: ["$value", "blur"],
            type: "shadow",
            reason: "missing-property",
            property: "blur",
            message: "a shadow needs `blur`",
        },
        {
            jsonPath: ["$value", "value"],
            type: "dimension",
            reason: "not-a-number",
            value: "16",
            message: "not a number",
        },
        {
            jsonPath: ["$value", "value"],
            type: "dimension",
            reason: "not-a-number",
            value: null,
            message: "not a number",
        },
        {
            jsonPath: ["$value", 0],
            type: "fontFamily",
            reason: "curly-brace-not-allowed-here",
            reference: "{font.brand}",
            message: "`{font.brand}` can't go inside a value",
        },
        {
            jsonPath: ["$value", "value"],
            type: "dimension",
            reason: "curly-brace-not-allowed-here",
            reference: "{space.4}",
            message: "`{space.4}` can't go inside a value",
        },
        {
            jsonPath: ["$value"],
            type: "color",
            reason: "hex-string",
            value: "#e11d48",
            asObject: { colorSpace: "srgb", components: [0.8824, 0.1137, 0.2824], hex: "#e11d48" },
            message: "a color can't be a hex string",
        },
        {
            jsonPath: ["$value", "colorSpace"],
            type: "color",
            reason: "unknown-color-space",
            value: "rgb",
            message: "`rgb` is not a color space",
        },
        {
            jsonPath: ["$value", "colorSpace"],
            type: "color",
            reason: "unknown-color-space",
            value: "okhsl",
            message: "`okhsl` is not a color space",
        },
        {
            jsonPath: ["$value", "colorSpace"],
            type: "color",
            reason: "unknown-color-space",
            value: 5,
            message: "`colorSpace` must be a string",
        },
        {
            jsonPath: ["$value", "components"],
            type: "color",
            reason: "not-three-components",
            value: [1, 0, 0, 1],
            message: "a color needs three components",
        },
        {
            jsonPath: ["$value", "components"],
            type: "color",
            reason: "not-three-components",
            value: "1 0 0",
            message: "`components` must be a list",
        },
        {
            jsonPath: ["$value", "components", 1],
            type: "color",
            reason: "component-not-a-number",
            value: "0.5",
            message: 'a component must be a number or `"none"`',
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
            message: "`Hue` out of range",
            help: "use 0 up to, not including, 360",
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
            message: "`Red` out of range",
            help: "use 0 to 1",
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
            message: "`Chroma` out of range",
            help: "use 0 or more",
        },
        {
            jsonPath: ["$value", "alpha"],
            type: "color",
            reason: "alpha-out-of-range",
            value: 1.5,
            message: "alpha out of range",
            help: "use 0 to 1",
        },
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
            message: "`hex` must have six digits",
        },
        {
            jsonPath: ["$value", "hex"],
            type: "color",
            reason: "hex-not-six-digits",
            value: 16711680,
            message: "`hex` must have six digits",
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
            message: "a duration can't be a string",
            help: 'write `{ "value": 200, "unit": "ms" }`',
        },
        {
            jsonPath: ["$value"],
            type: "cubicBezier",
            reason: "not-four-numbers",
            count: 3,
            message: "a cubic Bézier needs four numbers",
        },
        {
            jsonPath: ["$value", 0],
            type: "cubicBezier",
            reason: "x-out-of-range",
            value: 1.2,
            coordinate: "x1",
            message: "`x1` out of range",
            help: "use 0 to 1",
        },
        {
            jsonPath: ["$value"],
            type: "fontFamily",
            reason: "empty-font-list",
            message: "the font list is empty",
        },
        {
            jsonPath: ["$value", 1],
            type: "fontFamily",
            reason: "not-a-font-name",
            value: 4,
            message: "a font name must be a string",
        },
        {
            jsonPath: ["$value"],
            type: "fontFamily",
            reason: "not-a-font-name",
            value: "  ",
            message: "a font name can't be empty",
        },
        {
            jsonPath: ["$value"],
            type: "strokeStyle",
            reason: "unknown-stroke-style-keyword",
            value: "thick",
            keywords: strokeStyleKeywords,
            message: "`thick` is not a stroke style",
            help: "use `solid`, `dashed`, `dotted`, `double`, `groove`, `ridge`, `outset` or `inset`",
        },
        {
            jsonPath: ["$value", "dashArray"],
            type: "strokeStyle",
            reason: "dash-array-not-a-list",
            value: "4px 2px",
            message: "`dashArray` must be a list",
        },
        {
            jsonPath: ["$value", "dashArray"],
            type: "strokeStyle",
            reason: "empty-dash-array",
            message: "`dashArray` is empty",
        },
        {
            jsonPath: ["$value", "lineCap"],
            type: "strokeStyle",
            reason: "unknown-line-cap",
            value: "flat",
            lineCaps,
            message: "`flat` is not a line cap",
            help: "use `round`, `butt` or `square`",
        },
        {
            jsonPath: ["$value"],
            type: "shadow",
            reason: "no-shadows",
            message: "the shadow list is empty",
        },
        {
            jsonPath: ["$value"],
            type: "gradient",
            reason: "no-gradient-stops",
            message: "the gradient has no stops",
        },
        {
            jsonPath: ["$value", "inset"],
            type: "shadow",
            reason: "not-a-boolean",
            value: "yes",
            message: "not true or false",
        },
        {
            jsonPath: ["$value"],
            type: "fontWeight",
            reason: "font-weight-out-of-range",
            value: 1200,
            message: "font weight out of range",
            help: "use 1 to 1000",
        },
        {
            jsonPath: ["$value"],
            type: "fontWeight",
            reason: "unknown-font-weight-keyword",
            value: "Bold",
            message: "`Bold` is not a font weight",
            help: "write `bold`",
        },
        {
            jsonPath: ["$value"],
            type: "fontWeight",
            reason: "unknown-font-weight-keyword",
            value: "heavyweight",
            message: "`heavyweight` is not a font weight",
        },
        {
            jsonPath: ["base", "min"],
            type: "dimension",
            reason: "reference-not-allowed",
            reference: "{space.md}",
            message: "a reference isn't allowed here",
        },
        {
            jsonPath: ["$value", "unit"],
            type: "dimension",
            reason: "unit-not-allowed",
            unit: "em",
            allowed: dimensionUnits,
            message: "`em` is not a dimension unit",
            help: "use `px` or `rem`",
        },
        {
            jsonPath: ["$value", "unit"],
            type: "duration",
            reason: "unit-not-allowed",
            unit: 5,
            allowed: durationUnits,
            message: "`unit` must be a string",
            help: "use `ms` or `s`",
        },
    ],
    "hex-string-color": [
        {
            value: "#e11d48",
            asObject: { colorSpace: "srgb", components: [0.8824, 0.1137, 0.2824], hex: "#e11d48" },
            message: "a color can't be a hex string",
        },
    ],
    "extension-invalid": [
        {
            key: "sh.sugarcube",
            jsonPath: ["$extensions", "sh.sugarcube", "scale", "mode"],
            message: "invalid `sh.sugarcube` extension",
        },
        {
            key: "sh.sugarcube",
            jsonPath: ["$extensions", "sh.sugarcube", "scale", "ratio", "min"],
            reason: "ratio-not-above-one",
            data: { ratio: 1 },
            message: "invalid `sh.sugarcube` extension",
        },
    ],
    "written-generated": [
        {
            path: "size.step.3",
            from: "size.step",
            extension: ["sh.sugarcube", "scale"],
            written: "token",
            message: "`size.step.3` is made by `sh.sugarcube.scale` on `size.step`",
        },
        {
            path: "md",
            from: "",
            extension: ["sh.sugarcube", "scale"],
            written: "group",
            message: "`md` is made by `sh.sugarcube.scale` on the top level",
        },
    ],
    "missing-reference": [
        { ref: "color.brnad", from: ["color.danger"], message: "`color.brnad` does not exist" },
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
            message: "`#/color/inc/$value` does not exist",
            help: "did you mean `#/color/ink/$value`?",
        },
    ],
    "not-a-group": [{ ref: "color.brand", message: "`color.brand` is a token, not a group" }],
    "malformed-pointer": [
        {
            ref: "#color/ink",
            reason: "no-leading-slash",
            corrected: "#/color/ink",
            message: "`#color/ink` is not a JSON Pointer",
            help: "write `#/color/ink`",
        },
        {
            ref: "#missing/$value",
            reason: "no-leading-slash",
            message: "`#missing/$value` is not a JSON Pointer",
        },
        {
            ref: "#/a~b",
            reason: "bad-escape",
            corrected: "#/a~0b",
            message: "`~` and `/` must be escaped",
            help: "write `#/a~0b`",
        },
    ],
    "not-a-token": [{ ref: "color.accent", message: "`color.accent` is a group, not a token" }],
    "not-a-value": [
        {
            ref: "#/base",
            corrected: "#/base/$value",
            message: "a `$ref` must point at a value",
            help: "write `#/base/$value`",
        },
    ],
    "ref-and-value": [{ message: "a token can't have both `$ref` and `$value`" }],
    "reference-to-several": [
        { ref: "shadow.layered", count: 3, message: "`shadow.layered` is itself a list" },
    ],
    "circular-reference": [
        {
            chain: ["color.a", "color.b", "color.a"],
            message: "circular reference through `color.a`, `color.b`, `color.a`",
        },
    ],
    "type-mismatch": [
        {
            ref: "space.md",
            expected: "color",
            found: "dimension",
            message: "`space.md` is a dimension, not a color",
        },
    ],
    "whitespace-in-name": [
        {
            name: "brand ",
            message: "a name can't start or end with a space",
        },
    ],
    "unknown-property": [
        { property: "colour", owner: "resolver", message: "`colour` is not a resolver property" },
        {
            property: "descripton",
            owner: "set",
            similar: "description",
            message: "`descripton` is not a set property",
            help: "did you mean `description`?",
        },
        { property: "defualt", owner: "modifier", message: "`defualt` is not a modifier property" },
        { property: "$whatever", owner: "token", message: "`$whatever` is not a token property" },
        { property: "owner", owner: "set", message: "`owner` is not a set property" },
        {
            property: "$metadata",
            owner: "group",
            ignored: true,
            message: "`$metadata` is not a group property",
        },
        {
            property: "paragraphSpacing",
            type: "typography",
            jsonPath: ["$value", "paragraphSpacing"],
            message: "`paragraphSpacing` is not a typography property",
        },
        {
            property: "fluid",
            type: "dimension",
            jsonPath: ["$value", "width", "fluid"],
            message: "`fluid` is not a dimension property",
        },
    ],
    "misspelt-property": [
        {
            written: "value",
            property: "$value",
            owner: "token",
            message: "`value` is not a token property",
            help: "did you mean `$value`?",
        },
        {
            written: "$tpye",
            property: "$type",
            owner: "group",
            message: "`$tpye` is not a group property",
            help: "did you mean `$type`?",
        },
    ],
    "permutation-limit": [
        {
            count: 64,
            limit: 32,
            built: 7,
            message: "too many combinations: 64, over the limit of 32",
        },
    ],
    "not-in-resolution-order": [
        { item: "set", name: "palette", message: "the set `palette` is never used" },
        { item: "modifier", name: "density", message: "the modifier `density` is never used" },
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
    (examples[kind] as { message: string; help?: string }[]).map(
        ({ message: expected, help: expectedHelp, ...detail }) => {
            const entry = diagnosticMessages[kind];
            return {
                kind: "reason" in detail ? `${kind}, ${String(detail.reason)}` : kind,
                message: (entry.message as Words)(detail),
                help: (entry.help as Words | undefined)?.(detail),
                expected,
                expectedHelp,
            };
        },
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

    it.for(messages)(
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
