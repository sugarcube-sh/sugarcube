import { describe, expect, it } from "vitest";
import {
    type DesignTokens,
    type Reference,
    type Span,
    isReference,
    readFromMemory,
} from "../../src/index.js";

const color = (red: number) => ({ $value: { colorSpace: "srgb", components: [red, 0, 0] } });
const px = (value: number) => ({ value, unit: "px" });

const files: Record<string, string> = {
    "tokens.resolver.json": JSON.stringify({
        version: "2025.10",
        resolutionOrder: [
            { type: "set", name: "base", sources: [{ $ref: "base.json" }] },
            {
                type: "modifier",
                name: "mode",
                default: "light",
                contexts: { light: [], dark: [{ $ref: "dark.json" }] },
            },
        ],
    }),
    "base.json": JSON.stringify({
        color: {
            $type: "color",
            red: color(1),
            blue: color(0.2),
            brand: { $value: "{color.red}" },
            text: { $value: "{color.brand}" },
            tint: {
                $value: {
                    colorSpace: "srgb",
                    components: [{ $ref: "#/color/red/$value/components/0" }, 0, 0],
                },
            },
        },
        border: {
            $type: "border",
            focus: {
                $value: { color: { $ref: "#/color/brand/$value" }, width: px(1), style: "solid" },
            },
        },
        button: { $type: "dimension", pad: { $value: px(4) } },
        primary: { $extends: "{button}" },
    }),
    "dark.json": JSON.stringify({ color: { brand: { $value: "{color.blue}" } } }),
};

const tokens = readFromMemory({ files, entry: "tokens.resolver.json" });
const light = tokens.permutation({ mode: "light" });
const dark = tokens.permutation({ mode: "dark" });
const inLight = (path: string) => (light ? light.token(path) : undefined);
const inDark = (path: string) => (dark ? dark.token(path) : undefined);

function written(span: Span, from: Record<string, string> = files): string {
    return (from[span.file] ?? "").slice(span.offset, span.offset + span.length);
}

function oneFile(json: unknown): DesignTokens {
    return readFromMemory({ files: { "tokens.json": JSON.stringify(json) } });
}

describe("a token's references", () => {
    it("are each reference it writes, with the token it references (Format 7.1.1)", () => {
        const [reference, ...rest] = inLight("color.brand")?.references ?? [];
        expect(rest).toStrictEqual([]);
        expect(reference?.syntax).toBe("curly-brace");
        expect(reference?.path).toBe("color.red");
        expect(reference?.from).toBe(inLight("color.brand"));
        expect(reference?.token).toBe(inLight("color.red"));
        expect(reference?.property).toBeUndefined();
        expect(reference && written(tokens.spanOf(reference))).toBe('"{color.red}"');
    });

    it("include a JSON Pointer, by the token path it names (Format 7.1.2)", () => {
        const [reference] = inLight("border.focus")?.references ?? [];
        expect(reference?.syntax).toBe("json-pointer");
        expect(reference?.syntax === "json-pointer" && reference.pointer).toBe(
            "#/color/brand/$value",
        );
        expect(reference?.path).toBe("color.brand");
        expect(reference?.token).toBe(inLight("color.brand"));
        expect(reference?.property).toStrictEqual(["color"]);
        expect(reference && written(tokens.spanOf(reference))).toBe(
            '{"$ref":"#/color/brand/$value"}',
        );
    });

    it("reference no token when a pointer names a property within a value, and say which (Format 7.3)", () => {
        const [reference] = inLight("color.tint")?.references ?? [];
        expect(reference?.path).toBe("color.red");
        expect(reference?.token).toBeUndefined();
        expect(reference?.targetProperty).toStrictEqual(["components", 0]);
        expect(reference?.property).toStrictEqual(["components", 0]);
    });

    it("reference nothing when a pointer names a property the value doesn't have", () => {
        const pointed = oneFile({
            red: color(1),
            tint: {
                $type: "color",
                $value: {
                    colorSpace: "srgb",
                    components: [{ $ref: "#/red/$value/components/9" }, 0, 0],
                },
            },
        });
        const [reference] = pointed.permutation().token("tint")?.references ?? [];
        expect(reference?.path).toBe("red");
        expect(reference?.token).toBeUndefined();
        expect(reference?.targetProperty).toBeUndefined();
    });

    it("have no targetProperty when they reference the complete value (Format 7.4.2)", () => {
        expect(inLight("border.focus")?.references[0]?.targetProperty).toBeUndefined();
        expect(inLight("color.brand")?.references[0]?.targetProperty).toBeUndefined();
    });

    it("reference the token of their own permutation", () => {
        expect(inDark("color.brand")?.references[0]?.token).toBe(inDark("color.blue"));
        expect(inDark("color.text")?.references[0]?.token).toBe(inDark("color.brand"));
    });

    it("are empty for a token that writes none", () => {
        expect(inLight("color.red")?.references).toStrictEqual([]);
    });

    it("reference no token when the path names nothing or a group", () => {
        const broken = oneFile({
            size: { $type: "number", one: { $value: 1 } },
            gap: { $type: "number", $value: "{size.two}" },
            all: { $type: "number", $value: "{size}" },
        });
        const [missing] = broken.permutation().token("gap")?.references ?? [];
        expect(missing?.path).toBe("size.two");
        expect(missing?.token).toBeUndefined();
        expect(broken.permutation().token("all")?.references[0]?.token).toBeUndefined();
    });

    it("are kept for a value that can't be read as a whole", () => {
        const invalid = oneFile({
            color: { $type: "color", ink: color(0) },
            line: {
                $type: "border",
                $value: { color: "{color.ink}", width: "wide", style: "solid" },
            },
        });
        const line = invalid.permutation().token("line");
        expect(line?.invalid).toBe(true);
        expect(line?.references.map(({ path }) => path)).toStrictEqual(["color.ink"]);
        expect(invalid.permutation().referencedBy("color.ink")[0]?.from).toBe(line);
    });
});

describe("a reference in a value", () => {
    it("is written the way the file writes it, in the spec's syntax names", () => {
        expect(inLight("color.brand")?.value).toStrictEqual({
            syntax: "curly-brace",
            path: "color.red",
        });
        const focus = inLight("border.focus");
        if (focus?.type !== "border" || !focus.value || isReference(focus.value)) {
            throw new Error("border.focus is not a border written as a value");
        }
        expect(focus.value.color).toStrictEqual({
            syntax: "json-pointer",
            pointer: "#/color/brand/$value",
        });
    });

    it("is told apart from a value by isReference", () => {
        expect(isReference(inLight("color.brand")?.value)).toBe(true);
        expect(isReference(inLight("color.red")?.value)).toBe(false);
        expect(isReference(inLight("border.focus")?.references[0])).toBe(true);
    });
});

describe("referenceAt", () => {
    const focus = inLight("border.focus");

    it("is the reference written at a place in the value", () => {
        expect(focus?.referenceAt(["color"])).toBe(focus?.references[0]);
        expect(inLight("color.brand")?.referenceAt([])).toBe(inLight("color.brand")?.references[0]);
        expect(inLight("color.brand")?.referenceAt()).toBe(inLight("color.brand")?.references[0]);
    });

    it("is undefined where a value is written", () => {
        expect(focus?.referenceAt(["width"])).toBeUndefined();
        expect(focus?.referenceAt([])).toBeUndefined();
    });
});

describe("permutation.referencedBy", () => {
    it("is every reference to the path, each with the token that writes it", () => {
        const red = inLight("color.red");
        const reaching = light.referencedBy("color.red");
        expect(reaching.map(({ from }) => from.path)).toStrictEqual(["color.brand", "color.tint"]);
        expect(reaching.every(({ path }) => path === red?.path)).toBe(true);
    });

    it("follows chained references when asked (Format 7.2.2), each once, in written order", () => {
        const chained = light.referencedBy("color.red", { chained: true });
        expect(chained.map(({ from, path }) => `${from.path} > ${path}`)).toStrictEqual([
            "color.brand > color.red",
            "color.text > color.brand",
            "color.tint > color.red",
            "border.focus > color.brand",
        ]);
    });

    it("is the permutation's own: in mode: dark, color.red's only user is the tint", () => {
        const reaching = dark.referencedBy("color.red");
        expect(reaching.map(({ from }) => from.path)).toStrictEqual(["color.tint"]);
    });

    it("follows a loop once, without repeating", () => {
        const loop = oneFile({
            a: { $type: "number", $value: "{b}" },
            b: { $type: "number", $value: "{a}" },
        });
        const chained = loop.permutation().referencedBy("a", { chained: true });
        expect(chained.map(({ from }) => from.path)).toStrictEqual(["a", "b"]);
    });

    it("is empty when nothing references it", () => {
        expect(light.referencedBy("color.text")).toStrictEqual([]);
    });
});

describe("a group's $extends", () => {
    it("links the group to the group it extends (Format 6.4)", () => {
        expect(tokens.permutation().group("primary")?.extends).toBe(
            tokens.permutation().group("button"),
        );
    });

    it("is a reference the group writes, referencing no token (Format 6.4.5)", () => {
        const [reference, ...rest] = tokens.permutation().group("primary")?.references ?? [];
        expect(rest).toStrictEqual([]);
        expect(reference?.syntax).toBe("curly-brace");
        expect(reference?.path).toBe("button");
        expect(reference?.from).toBe(tokens.permutation().group("primary"));
        expect(reference?.token).toBeUndefined();
        expect(reference && written(tokens.spanOf(reference))).toBe('"{button}"');
    });

    it("is a JSON Pointer when written as one, $extends or a group's $ref", () => {
        const pointed = oneFile({
            button: { $type: "number", pad: { $value: 1 } },
            primary: { $extends: { $ref: "#/button" } },
            secondary: { $ref: "#/button" },
        });
        for (const path of ["primary", "secondary"]) {
            const [reference] = pointed.permutation().group(path)?.references ?? [];
            expect(reference?.syntax).toBe("json-pointer");
            expect(reference?.path).toBe("button");
            expect(pointed.permutation().group(path)?.extends).toBe(
                pointed.permutation().group("button"),
            );
        }
    });

    it("leaves a group that extends nothing without references", () => {
        expect(tokens.permutation().group("button")?.references).toStrictEqual([]);
        expect(tokens.permutation().group("button")?.extends).toBeUndefined();
    });
});

describe("a curly brace reference's path", () => {
    const named = readFromMemory({
        files: {
            "tokens.json": JSON.stringify({
                base: { $type: "color", red: color(1) },
                extending: { $extends: "{base.red.$value}" },
                aliasing: { $type: "color", $value: "{base.red.$value}" },
            }),
        },
    });
    const found = (path: string) =>
        named.diagnosticsFor(path).map(({ kind, detail }) => ({ kind, detail }));

    it("names a token or group, so $value in it is a name, not a step into a value (Format 7.1.1)", () => {
        const missing = {
            kind: "missing-reference",
            detail: expect.objectContaining({ ref: "base.red.$value" }),
        };
        expect(found("aliasing")).toStrictEqual([missing]);
        expect(found("extending")).toStrictEqual([missing]);
    });
});

describe("moved", () => {
    const moves = (from: string, to: string) => [{ from, to }];

    it("writes a curly brace reference after a move", () => {
        const [reference] = inLight("color.brand")?.references ?? [];
        expect(reference?.moved(moves("color.red", "color.crimson"))).toBe("{color.crimson}");
        expect(reference?.moved(moves("color", "palette"))).toBe("{palette.red}");
    });

    it("writes a JSON Pointer after a move, keeping its steps into the value", () => {
        expect(
            inLight("border.focus")?.references[0]?.moved(moves("color.brand", "color.house")),
        ).toStrictEqual({ $ref: "#/color/house/$value" });
        expect(
            inLight("color.tint")?.references[0]?.moved(moves("color.red", "color.crimson")),
        ).toStrictEqual({ $ref: "#/color/crimson/$value/components/0" });
    });

    it("writes the reference as it was when no move reaches it", () => {
        expect(inLight("color.brand")?.references[0]?.moved(moves("size", "space"))).toBe(
            "{color.red}",
        );
    });

    it("writes what stands at the reference's place: a group's $ref is the pointer alone", () => {
        const text = JSON.stringify({
            button: { $type: "number", pad: { $value: 1 } },
            primary: { $extends: "{button}" },
            secondary: { $ref: "#/button" },
        });
        const pointed = readFromMemory({ files: { "tokens.json": text } });
        const [extending] = pointed.permutation().group("primary")?.references ?? [];
        const [referring] = pointed.permutation().group("secondary")?.references ?? [];
        expect(extending?.moved(moves("button", "control"))).toBe("{control}");
        expect(referring?.moved(moves("button", "control"))).toBe("#/control");
        expect(referring && written(pointed.spanOf(referring), { "tokens.json": text })).toBe(
            '"#/button"',
        );
    });
});

describe("refersTo, on a permutation", () => {
    const named = (references: readonly Reference[]) =>
        references.map(({ from, path }) => `${from.path} > ${path}`);

    it("gives the references a path's value writes, as that permutation reads it", () => {
        const [red] = light.refersTo("color.brand");
        expect(red?.path).toBe("color.red");
        expect(red && tokens.spanOf(red).file).toBe("base.json");
        expect(dark.refersTo("color.brand").map(({ path }) => path)).toStrictEqual(["color.blue"]);
    });

    it("follows chained references, each once", () => {
        expect(named(light.refersTo("color.text", { chained: true }))).toStrictEqual([
            "color.text > color.brand",
            "color.brand > color.red",
        ]);
        expect(named(dark.refersTo("color.text", { chained: true }))).toStrictEqual([
            "color.text > color.brand",
            "color.brand > color.blue",
        ]);
    });

    it("follows a property-level reference on to what the token holding the property references", () => {
        const pointed = oneFile({
            ink: color(0),
            line: {
                $type: "border",
                $value: { color: "{ink}", width: px(1), style: "solid" },
            },
            gap: { $type: "dimension", $value: { $ref: "#/line/$value/width" } },
        });
        expect(named(pointed.refersTo("gap", { chained: true }))).toStrictEqual([
            "gap > line",
            "line > ink",
        ]);
    });

    it("gives a group's $extends, and nothing for a path that isn't there", () => {
        const extending = oneFile({
            button: { $type: "number", pad: { $value: 1 } },
            primary: { $extends: "{button}" },
        });
        expect(named(extending.refersTo("primary"))).toStrictEqual(["primary > button"]);
        expect(extending.refersTo("nope")).toStrictEqual([]);
    });

    it("is safe with a loop", () => {
        const looped = oneFile({
            a: { $type: "number", $value: "{b}" },
            b: { $type: "number", $value: "{a}" },
        });
        expect(named(looped.refersTo("a", { chained: true }))).toStrictEqual(["a > b", "b > a"]);
    });
});

describe("on the design tokens", () => {
    it("referencedBy gives every reference to a path, each with the permutations it is in", () => {
        const reaching = tokens.referencedBy("color.red");
        expect(reaching.map(({ from, permutations }) => [from, permutations.inputs])).toStrictEqual(
            [
                ["color.brand", [{ mode: "light" }]],
                ["color.tint", [{ mode: "light" }, { mode: "dark" }]],
            ],
        );
        expect(reaching[0]).not.toHaveProperty("token");
        expect(reaching[0] && written(reaching[0].span)).toBe('"{color.red}"');
    });

    it("referencedBy a group's path covers its $extends and the tokens inside it", () => {
        const referring = oneFile({
            button: { $type: "number", pad: { $value: 1 } },
            primary: { $extends: "{button}" },
            gap: { $type: "number", $value: "{button.pad}" },
        });
        const reaching = referring.referencedBy("button");
        expect(reaching.map(({ from, path }) => `${from} > ${path}`)).toStrictEqual([
            "primary > button",
            "gap > button.pad",
        ]);
    });

    it("referencedBy a group's path gives its references in the order they are written", () => {
        const referring = oneFile({
            size: { $type: "number", small: { $value: 1 }, large: { $value: 2 } },
            a: { $type: "number", $value: "{size.small}" },
            b: { $type: "number", $value: "{size.large}" },
            c: { $type: "number", $value: "{size.small}" },
        });
        const reaching = referring.referencedBy("size");
        expect(reaching.map(({ from }) => `${from}`)).toStrictEqual(["a", "b", "c"]);
    });

    it("gives records that can be moved", () => {
        const [reference] = tokens.referencedBy("color.red");
        expect(reference?.moved([{ from: "color.red", to: "color.crimson" }])).toBe(
            "{color.crimson}",
        );
    });
});

describe("the plain form", () => {
    const plain = (value: unknown) => JSON.parse(JSON.stringify(value));

    it("writes each reference on the token that writes it, without its from, token or position", () => {
        const [curly] = plain(inLight("color.brand")).references;
        expect(Object.keys(curly).sort()).toStrictEqual(["path", "syntax"]);
    });

    it("writes a JSON Pointer without the path and target property it works out from the pointer", () => {
        const [pointer] = plain(inLight("color.tint")).references;
        expect(Object.keys(pointer).sort()).toStrictEqual(["pointer", "property", "syntax"]);
    });

    it("writes a group's $extends among its references, and no extends link", () => {
        const primary = plain(tokens.permutation().group("primary"));
        expect(primary.references.map(({ path }: { path: string }) => path)).toStrictEqual([
            "button",
        ]);
        expect(primary).not.toHaveProperty("extends");
    });

    it("has no edges", () => {
        expect(plain(light)).not.toHaveProperty("edges");
    });
});
