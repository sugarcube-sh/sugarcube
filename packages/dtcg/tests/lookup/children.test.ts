import { describe, expect, it } from "vitest";
import { type DesignTokens, defineGenerator, readFromMemory } from "../../src/index.js";

const color = (red: number) => ({ $value: { colorSpace: "srgb", components: [red, 0, 0] } });

const paths = (items: readonly { path: string }[] | undefined) => items?.map(({ path }) => path);

function oneFile(json: unknown): DesignTokens {
    return readFromMemory({ files: { "tokens.json": JSON.stringify(json) } });
}

describe("a group's children", () => {
    const tokens = oneFile({
        color: {
            $type: "color",
            bg: color(1),
            brand: { "500": color(0.5), "$root": color(0.6) },
            text: color(0),
            raw: {},
        },
        space: { $type: "number", sm: { $value: 1 } },
    });

    it("are the paths directly inside it, tokens and groups together, in the order the file writes them", () => {
        expect(paths(tokens.permutation().group("color")?.children)).toStrictEqual([
            "color.bg",
            "color.brand",
            "color.text",
            "color.raw",
        ]);
    });

    it("include a group's own $root token where it is written", () => {
        expect(paths(tokens.permutation().group("color.brand")?.children)).toStrictEqual([
            "color.brand.500",
            "color.brand.$root",
        ]);
    });

    it("give a group's child tokens alone as childTokens, in the same order, its $root included", () => {
        const colors = tokens.permutation().group("color");
        const brand = tokens.permutation().group("color.brand");

        expect(paths(colors?.childTokens)).toStrictEqual(["color.bg", "color.text"]);
        expect(paths(brand?.childTokens)).toStrictEqual(["color.brand.500", "color.brand.$root"]);
        expect(colors?.childTokens).toStrictEqual(
            colors?.children.filter((child) => child.kind === "token"),
        );
        expect(paths(tokens.permutation().group("color.raw")?.childTokens)).toStrictEqual([]);
    });

    it("give the same lists each time they are read, as children does", () => {
        const colors = tokens.permutation().group("color")!;

        expect(colors.childTokens).toBe(colors.childTokens);
        expect(colors.tokens).toBe(colors.tokens);
        expect(colors.children).toBe(colors.children);
    });

    it("are the tokens and groups themselves", () => {
        const [bg, brand] = tokens.permutation().group("color")?.children ?? [];
        expect(bg).toBe(tokens.permutation().token("color.bg"));
        expect(brand).toBe(tokens.permutation().group("color.brand"));
    });

    it("are empty for an empty group", () => {
        expect(paths(tokens.permutation().group("color.raw")?.children)).toStrictEqual([]);
    });

    it("leave out a token the read could not keep", () => {
        const untyped = oneFile({
            loose: { kept: { $type: "number", $value: 1 }, lost: { $value: 2 } },
        });
        expect(paths(untyped.permutation().group("loose")?.children)).toStrictEqual(["loose.kept"]);
    });
});

describe("the top level", () => {
    const tokens = oneFile({
        color: { $type: "number", a: { $value: 1 } },
        gap: { $type: "number", $value: 2 },
    });
    const base = tokens.permutation();

    it("is walked from the permutation: its children are what the file writes at the top, in order", () => {
        expect(paths(base?.children)).toStrictEqual(["color", "gap"]);
        expect(base?.children[1]).toBe(tokens.permutation().token("gap"));
    });

    it("keeps only what is written there in root, not its children", () => {
        expect(base && "children" in base.root).toBe(false);
    });

    it('has no path, so nothing reaches it by one: (…).permutation().group("") is the group named ""', () => {
        expect(base && "path" in base.root).toBe(false);
        expect(tokens.permutation().group("")).toBeUndefined();
    });

    it("is not among the permutation's groups", () => {
        expect(base?.groups.map(({ path }) => path)).toStrictEqual(["color"]);
    });

    it("keeps a $type written at the top of the file", () => {
        const typed = oneFile({ $type: "number", gap: { $value: 2 } });
        expect(typed.permutation().root.type).toBe("number");
    });
});

describe("across files and themes", () => {
    const resolver = {
        version: "2025.10",
        resolutionOrder: [
            { type: "set", name: "base", sources: [{ $ref: "a.json" }, { $ref: "b.json" }] },
            {
                type: "modifier",
                name: "mode",
                default: "light",
                contexts: { light: [], dark: [{ $ref: "dark.json" }] },
            },
        ],
    };
    const tokens = readFromMemory({
        files: {
            "tokens.resolver.json": JSON.stringify(resolver),
            "a.json": JSON.stringify({
                color: { $type: "color", bg: color(1) },
                size: { $type: "number", s: { $value: 1 } },
            }),
            "b.json": JSON.stringify({
                color: { text: color(0) },
                gap: { $type: "number", $value: 2 },
            }),
            "dark.json": JSON.stringify({ color: { glow: color(0.2), bg: color(0) } }),
        },
        entry: "tokens.resolver.json",
    });

    it("put what a later file adds to a group at the end of its children", () => {
        expect(paths(tokens.permutation().group("color")?.children)).toStrictEqual([
            "color.bg",
            "color.text",
        ]);
    });

    it("list the top level across the files, in the order they are read", () => {
        expect(paths(tokens.permutation().children)).toStrictEqual(["color", "size", "gap"]);
    });

    it("are each permutation's own: dark's group has dark's token, light's doesn't", () => {
        expect(paths(tokens.permutation({ mode: "dark" }).group("color")?.children)).toStrictEqual([
            "color.bg",
            "color.text",
            "color.glow",
        ]);
        expect(paths(tokens.permutation({ mode: "light" }).group("color")?.children)).not.toContain(
            "color.glow",
        );
    });

    it("put an override where the token was first written", () => {
        const dark = tokens.permutation({ mode: "dark" });
        expect(dark.group("color")?.children[0]?.path).toBe("color.bg");
    });
});

describe("tokens that are not written", () => {
    it("put tokens a group takes through $extends at the end of its children", () => {
        const tokens = oneFile({
            button: { $type: "number", pad: { $value: 1 }, gap: { $value: 2 } },
            primary: { $extends: "{button}", own: { $value: 3 }, pad: { $value: 4 } },
        });
        expect(paths(tokens.permutation().group("primary")?.children)).toStrictEqual([
            "primary.own",
            "primary.pad",
            "primary.gap",
        ]);
    });

    it("put tokens a generator makes at the end of their group, as the token list does", () => {
        const steps = defineGenerator({
            extension: ["com.example", "steps"],
            messages: {},
            generate: () => ({
                ok: true,
                value: ["3", "2", "1"].map((name) => ({ name, $value: Number(name) })),
            }),
        });
        const tokens = readFromMemory(
            {
                files: {
                    "tokens.json": JSON.stringify({
                        space: {
                            $type: "number",
                            $extensions: { "com.example": { steps: 3 } },
                            sub: {},
                        },
                    }),
                },
            },
            { generators: [steps] },
        );
        const tokenOrder = tokens
            .permutation()
            ?.tokens.map(({ path }) => path)
            .filter((path) => path.startsWith("space."));
        const children = paths(tokens.permutation().group("space")?.children);
        expect(children?.filter((path) => path !== "space.sub")).toStrictEqual(tokenOrder);
        expect(children?.indexOf("space.sub")).toBe(0);
    });
});

describe('a group named ""', () => {
    const tokens = oneFile({
        "": { $type: "number", x: { $value: 1 } },
        "size": { $type: "number", $value: 2 },
    });
    const base = tokens.permutation();

    it("is a child of the top level, and holds its own tokens, never the top level's (Format 5.1)", () => {
        expect(paths(base?.children)).toStrictEqual(["", "size"]);
        expect(paths(base?.groups.find(({ path }) => path === "")?.children)).toStrictEqual([".x"]);
        expect(paths(tokens.permutation().group("")?.children)).toStrictEqual([".x"]);
    });
});
