import { describe, expect, it } from "vitest";
import {
    type DesignTokens,
    type Span,
    isReference,
    readFromMemory,
} from "../../src/index.js";
import { getSpan } from "../../src/editor.js";

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
const light = tokens.getPermutation({ mode: "light" });
const dark = tokens.getPermutation({ mode: "dark" });
const inLight = (path: string) => (light ? light.getToken(path) : undefined);
const inDark = (path: string) => (dark ? dark.getToken(path) : undefined);

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
        expect(reference?.asWritten.syntax).toBe("curly-brace");
        expect(reference?.pointsToPath).toBe("color.red");
        expect(reference?.writtenIn).toBe(inLight("color.brand"));
        expect(reference?.pointsToToken).toBe(inLight("color.red"));
        expect(reference?.writtenInProperty).toBeUndefined();
        expect(reference && written(getSpan(tokens, reference))).toBe('"{color.red}"');
    });

    it("include a JSON Pointer, by the token path it names (Format 7.1.2)", () => {
        const [reference] = inLight("border.focus")?.references ?? [];
        expect(reference?.asWritten.syntax).toBe("json-pointer");
        expect(reference?.asWritten.syntax === "json-pointer" && reference.asWritten.pointer).toBe(
            "#/color/brand/$value",
        );
        expect(reference?.pointsToPath).toBe("color.brand");
        expect(reference?.pointsToToken).toBe(inLight("color.brand"));
        expect(reference?.writtenInProperty).toStrictEqual(["color"]);
        expect(reference && written(getSpan(tokens, reference))).toBe(
            '{"$ref":"#/color/brand/$value"}',
        );
    });

    it("reference no token when a pointer names a property within a value, and say which (Format 7.3)", () => {
        const [reference] = inLight("color.tint")?.references ?? [];
        expect(reference?.pointsToPath).toBe("color.red");
        expect(reference?.pointsToToken).toBeUndefined();
        expect(reference?.pointsToProperty).toStrictEqual(["components", 0]);
        expect(reference?.writtenInProperty).toStrictEqual(["components", 0]);
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
        const [reference] = pointed.getPermutation().getToken("tint")?.references ?? [];
        expect(reference?.pointsToPath).toBe("red");
        expect(reference?.pointsToToken).toBeUndefined();
        expect(reference?.pointsToProperty).toBeUndefined();
    });

    it("have no pointsToProperty when they reference the complete value (Format 7.4.2)", () => {
        expect(inLight("border.focus")?.references[0]?.pointsToProperty).toBeUndefined();
        expect(inLight("color.brand")?.references[0]?.pointsToProperty).toBeUndefined();
    });

    it("reference the token of their own permutation", () => {
        expect(inDark("color.brand")?.references[0]?.pointsToToken).toBe(inDark("color.blue"));
        expect(inDark("color.text")?.references[0]?.pointsToToken).toBe(inDark("color.brand"));
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
        const [missing] = broken.getPermutation().getToken("gap")?.references ?? [];
        expect(missing?.pointsToPath).toBe("size.two");
        expect(missing?.pointsToToken).toBeUndefined();
        expect(
            broken.getPermutation().getToken("all")?.references[0]?.pointsToToken,
        ).toBeUndefined();
    });

    it("are kept for a value that can't be read as a whole", () => {
        const invalid = oneFile({
            color: { $type: "color", ink: color(0) },
            line: {
                $type: "border",
                $value: { color: "{color.ink}", width: "wide", style: "solid" },
            },
        });
        const line = invalid.getPermutation().getToken("line");
        expect(line?.invalid).toBe(true);
        expect(line?.references.map(({ pointsToPath: path }) => path)).toStrictEqual(["color.ink"]);
        expect(invalid.getPermutation().getDependents("color.ink")).toStrictEqual([line]);
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
        expect(isReference(inLight("border.focus")?.references[0]?.asWritten)).toBe(true);
    });
});

describe("referenceAt", () => {
    const focus = inLight("border.focus");

    it("is the reference written at a place in the value", () => {
        expect(focus?.getReferenceAt(["color"])).toBe(focus?.references[0]);
        expect(inLight("color.brand")?.getReferenceAt([])).toBe(
            inLight("color.brand")?.references[0],
        );
        expect(inLight("color.brand")?.getReferenceAt()).toBe(
            inLight("color.brand")?.references[0],
        );
    });

    it("is undefined where a value is written", () => {
        expect(focus?.getReferenceAt(["width"])).toBeUndefined();
        expect(focus?.getReferenceAt([])).toBeUndefined();
    });
});

describe("permutation.usedBy", () => {
    const paths = (users: readonly { path: string }[]) => users.map(({ path }) => path);

    it("is every token that refers to the path", () => {
        expect(paths(light.getDependents("color.red"))).toStrictEqual([
            "color.brand",
            "color.tint",
        ]);
    });

    it("follows chained references when asked (Format 7.2.2), each once, in written order", () => {
        expect(paths(light.getDependents("color.red", { chained: true }))).toStrictEqual([
            "color.brand",
            "color.text",
            "color.tint",
            "border.focus",
        ]);
    });

    it("is the permutation's own: in mode: dark, color.red's only user is the tint", () => {
        expect(paths(dark.getDependents("color.red"))).toStrictEqual(["color.tint"]);
    });

    it("follows a loop once, without repeating", () => {
        const loop = oneFile({
            a: { $type: "number", $value: "{b}" },
            b: { $type: "number", $value: "{a}" },
        });
        expect(paths(loop.getPermutation().getDependents("a", { chained: true }))).toStrictEqual([
            "a",
            "b",
        ]);
    });

    it("is empty when nothing refers to it", () => {
        expect(light.getDependents("color.text")).toStrictEqual([]);
    });
});

describe("permutation.referencesTo", () => {
    it("is every reference to the path, each with the token that writes it", () => {
        const red = inLight("color.red");
        const reaching = light.getReferencesTo("color.red");
        expect(reaching.map(({ writtenIn: from }) => from.path)).toStrictEqual([
            "color.brand",
            "color.tint",
        ]);
        expect(reaching.every(({ pointsToPath: path }) => path === red?.path)).toBe(true);
    });

    it("follows chained references when asked (Format 7.2.2), each once, in written order", () => {
        const chained = light.getReferencesTo("color.red", { chained: true });
        expect(
            chained.map(({ writtenIn: from, pointsToPath: path }) => `${from.path} > ${path}`),
        ).toStrictEqual([
            "color.brand > color.red",
            "color.text > color.brand",
            "color.tint > color.red",
            "border.focus > color.brand",
        ]);
    });

    it("is the permutation's own: in mode: dark, color.red's only reference is the tint's", () => {
        expect(
            dark.getReferencesTo("color.red").map(({ writtenIn: from }) => from.path),
        ).toStrictEqual(["color.tint"]);
    });

    it("follows a loop once, without repeating", () => {
        const loop = oneFile({
            a: { $type: "number", $value: "{b}" },
            b: { $type: "number", $value: "{a}" },
        });
        const chained = loop.getPermutation().getReferencesTo("a", { chained: true });
        expect(chained.map(({ writtenIn: from }) => from.path)).toStrictEqual(["a", "b"]);
    });

    it("is empty when nothing references it", () => {
        expect(light.getReferencesTo("color.text")).toStrictEqual([]);
    });

    it("has no referencedBy beside it", () => {
        expect("referencedBy" in light).toBe(false);
    });
});

describe("a group's $extends", () => {
    it("links the group to the group it extends (Format 6.4)", () => {
        expect(tokens.getPermutation().getGroup("primary")?.extends).toBe(
            tokens.getPermutation().getGroup("button"),
        );
    });

    it("is a reference the group writes, referencing no token (Format 6.4.5)", () => {
        const [reference, ...rest] = tokens.getPermutation().getGroup("primary")?.references ?? [];
        expect(rest).toStrictEqual([]);
        expect(reference?.asWritten.syntax).toBe("curly-brace");
        expect(reference?.pointsToPath).toBe("button");
        expect(reference?.writtenIn).toBe(tokens.getPermutation().getGroup("primary"));
        expect(reference?.pointsToToken).toBeUndefined();
        expect(reference && written(getSpan(tokens, reference))).toBe('"{button}"');
    });

    it("is a JSON Pointer when written as one, $extends or a group's $ref", () => {
        const pointed = oneFile({
            button: { $type: "number", pad: { $value: 1 } },
            primary: { $extends: { $ref: "#/button" } },
            secondary: { $ref: "#/button" },
        });
        for (const path of ["primary", "secondary"]) {
            const [reference] = pointed.getPermutation().getGroup(path)?.references ?? [];
            expect(reference?.asWritten.syntax).toBe("json-pointer");
            expect(reference?.pointsToPath).toBe("button");
            expect(pointed.getPermutation().getGroup(path)?.extends).toBe(
                pointed.getPermutation().getGroup("button"),
            );
        }
    });

    it("leaves a group that extends nothing without references", () => {
        expect(tokens.getPermutation().getGroup("button")?.references).toStrictEqual([]);
        expect(tokens.getPermutation().getGroup("button")?.extends).toBeUndefined();
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
        named.getDiagnostics(path).map(({ kind, detail }) => ({ kind, detail }));

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
        const [extending] = pointed.getPermutation().getGroup("primary")?.references ?? [];
        const [referring] = pointed.getPermutation().getGroup("secondary")?.references ?? [];
        expect(extending?.moved(moves("button", "control"))).toBe("{control}");
        expect(referring?.moved(moves("button", "control"))).toBe("#/control");
        expect(referring && written(getSpan(pointed, referring), { "tokens.json": text })).toBe(
            '"#/button"',
        );
    });
});

describe("permutation.getDependencies", () => {
    const paths = (found: readonly { path: string }[]) => found.map(({ path }) => path);

    it("gives the tokens a path's value refers to, as that permutation reads it", () => {
        expect(light.getDependencies("color.brand")).toStrictEqual([inLight("color.red")]);
        expect(paths(dark.getDependencies("color.brand"))).toStrictEqual(["color.blue"]);
    });

    it("follows chained references, each token once", () => {
        expect(paths(light.getDependencies("color.text", { chained: true }))).toStrictEqual([
            "color.brand",
            "color.red",
        ]);
        expect(paths(dark.getDependencies("color.text", { chained: true }))).toStrictEqual([
            "color.brand",
            "color.blue",
        ]);
    });

    it("follows a property-level reference on to what the token holding the property refers to", () => {
        const pointed = oneFile({
            ink: { $type: "color", ...color(0) },
            line: {
                $type: "border",
                $value: { color: "{ink}", width: px(1), style: "solid" },
            },
            gap: { $type: "dimension", $value: { $ref: "#/line/$value/width" } },
        });
        expect(
            paths(pointed.getPermutation().getDependencies("gap", { chained: true })),
        ).toStrictEqual(["line", "ink"]);
    });

    it("gives the group a group's $extends names, and nothing for a path that isn't there", () => {
        const extending = oneFile({
            button: { $type: "number", pad: { $value: 1 } },
            primary: { $extends: "{button}" },
        }).getPermutation();
        expect(extending.getDependencies("primary")).toStrictEqual([extending.getGroup("button")]);
        expect(extending.getDependencies("nope")).toStrictEqual([]);
    });

    it("leaves out a reference to a token that isn't there, which the token's references still hold", () => {
        const missing = oneFile({ gap: { $type: "number", $value: "{nope}" } }).getPermutation();
        expect(missing.getDependencies("gap")).toStrictEqual([]);
        expect(
            missing.getToken("gap")?.references.map(({ pointsToPath }) => pointsToPath),
        ).toStrictEqual(["nope"]);
    });

    it("is safe with a loop", () => {
        const looped = oneFile({
            a: { $type: "number", $value: "{b}" },
            b: { $type: "number", $value: "{a}" },
        }).getPermutation();
        expect(paths(looped.getDependencies("a", { chained: true }))).toStrictEqual(["b", "a"]);
    });
});

describe("on the design tokens", () => {
    it("referencesTo gives every reference to a path, each with the permutations it is in", () => {
        const reaching = tokens.getReferencesTo("color.red");
        expect(
            reaching.map(({ writtenInPaths: fromPaths, permutations }) => [
                fromPaths,
                permutations.inputs,
            ]),
        ).toStrictEqual([
            [["color.brand"], [{ mode: "light" }]],
            [["color.tint"], [{ mode: "light" }, { mode: "dark" }]],
        ]);
        expect(reaching[0]).not.toHaveProperty("token");
        expect(reaching[0] && written(reaching[0].span)).toBe('"{color.red}"');
    });

    it("referencesTo a group's path covers its $extends and the tokens inside it", () => {
        const referring = oneFile({
            button: { $type: "number", pad: { $value: 1 } },
            primary: { $extends: "{button}" },
            gap: { $type: "number", $value: "{button.pad}" },
        });
        const reaching = referring.getReferencesTo("button");
        expect(
            reaching.map(
                ({ writtenInPaths: fromPaths, pointsToPath: path }) => `${fromPaths} > ${path}`,
            ),
        ).toStrictEqual(["primary > button", "gap > button.pad"]);
    });

    it("referencesTo a group's path gives its references in the order they are written", () => {
        const referring = oneFile({
            size: { $type: "number", small: { $value: 1 }, large: { $value: 2 } },
            a: { $type: "number", $value: "{size.small}" },
            b: { $type: "number", $value: "{size.large}" },
            c: { $type: "number", $value: "{size.small}" },
        });
        const reaching = referring.getReferencesTo("size");
        expect(reaching.map(({ writtenInPaths: fromPaths }) => `${fromPaths}`)).toStrictEqual([
            "a",
            "b",
            "c",
        ]);
    });

    it("referencesTo lists a reference a group inherits through $extends once, with every token that has it", () => {
        const inherited = oneFile({
            base: { $type: "number", $value: 1 },
            color: { $type: "number", x: { $value: "{base}" } },
            b: { $extends: "{color}" },
            c: { $extends: "{b}" },
        });
        const reaching = inherited.getReferencesTo("base");
        expect(reaching.map(({ writtenInPaths: fromPaths }) => fromPaths)).toStrictEqual([
            ["color.x", "b.x", "c.x"],
        ]);
    });

    it("is not referencedBy, nor modifier(name): the resolver's modifiers are the list", () => {
        expect("referencedBy" in tokens).toBe(false);
        expect("modifier" in tokens).toBe(false);
    });

    it("gives records that can be moved", () => {
        const [reference] = tokens.getReferencesTo("color.red");
        expect(reference?.moved([{ from: "color.red", to: "color.crimson" }])).toBe(
            "{color.crimson}",
        );
    });
});

describe("a reference's fields", () => {
    it("keep what is written apart from what it is written in and points to", () => {
        const reference = inLight("border.focus")?.references[0];
        expect(reference?.asWritten).toStrictEqual({
            syntax: "json-pointer",
            pointer: "#/color/brand/$value",
        });
        expect(reference?.writtenIn).toBe(inLight("border.focus"));
        expect(reference?.writtenInProperty).toStrictEqual(["color"]);
        expect(reference?.pointsToPath).toBe("color.brand");
        expect(reference?.pointsToToken).toBe(inLight("color.brand"));
        for (const gone of ["syntax", "pointer", "path", "from", "token", "property"]) {
            expect(reference).not.toHaveProperty(gone);
        }
    });
});

describe("the plain form", () => {
    const plain = (value: unknown) => JSON.parse(JSON.stringify(value));

    it("writes each reference on the token that writes it as written, without what it is written in, points to or its position", () => {
        const [curly] = plain(inLight("color.brand")).references;
        expect(curly).toStrictEqual({ asWritten: { syntax: "curly-brace", path: "color.red" } });
    });

    it("writes a JSON Pointer as written, with the part of the value it is written in", () => {
        const [pointer] = plain(inLight("color.tint")).references;
        expect(Object.keys(pointer).sort()).toStrictEqual(["asWritten", "writtenInProperty"]);
        expect(pointer.asWritten.syntax).toBe("json-pointer");
    });

    it("writes a group's $extends among its references, and no extends link", () => {
        const primary = plain(tokens.getPermutation().getGroup("primary"));
        expect(
            primary.references.map(
                ({ asWritten }: { asWritten: { path: string } }) => asWritten.path,
            ),
        ).toStrictEqual(["button"]);
        expect(primary).not.toHaveProperty("extends");
    });

    it("has no edges", () => {
        expect(plain(light)).not.toHaveProperty("edges");
    });
});
