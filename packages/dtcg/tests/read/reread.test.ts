import { describe, expect, it } from "vitest";
import { readFromMemory } from "../../src/index.js";
import { getSpan } from "../../src/editor.js";

const rgb = (red: number) => ({ colorSpace: "srgb", components: [red, 0, 0] });

const files = {
    "tokens.resolver.json": JSON.stringify({
        version: "2025.10",
        resolutionOrder: [
            {
                type: "set",
                name: "base",
                sources: [{ $ref: "colors.json" }, { $ref: "space.json" }, { $ref: "theme.json" }],
            },
            {
                type: "modifier",
                name: "mode",
                default: "light",
                contexts: { light: [], dark: [{ $ref: "dark.json" }] },
            },
        ],
    }),
    "colors.json": JSON.stringify({
        color: { $type: "color", red: { $value: rgb(1) }, blue: { $value: rgb(0) } },
    }),
    "space.json": JSON.stringify({
        space: { $type: "number", sm: { $value: 4 }, md: { $value: 8 } },
    }),
    "theme.json": JSON.stringify({
        theme: {
            text: { $type: "color", $value: "{color.red}" },
            gap: { $type: "number", $value: "{space.sm}" },
        },
    }),
    "dark.json": JSON.stringify({ color: { blue: { $value: rgb(0.2) } } }),
};

const before = readFromMemory({ files, entryFile: "tokens.resolver.json" });
const after = before.reread({
    "colors.json": JSON.stringify({
        color: { $type: "color", red: { $value: rgb(0.5) }, blue: { $value: rgb(0) } },
    }),
});
const modes = ["light", "dark"] as const;
const kept = (path: string) =>
    modes.every(
        (mode) =>
            before.getPermutation({ mode }).getToken(path) ===
            after.getPermutation({ mode }).getToken(path),
    );

describe("a reread", () => {
    it("keeps every token in a file whose text did not change", () => {
        expect(after.getPermutation().getToken("space.sm")).toBeDefined();
        expect(kept("space.sm")).toBe(true);
        expect(kept("space.md")).toBe(true);
    });

    it("keeps a token that points only at kept tokens", () => {
        expect(kept("theme.gap")).toBe(true);
    });

    it("makes a token whose value changed new, and every token that points at it", () => {
        expect(kept("color.red")).toBe(false);
        expect(kept("theme.text")).toBe(false);
        expect(after.getPermutation().getToken("color.red")?.resolved).toMatchObject({
            components: [0.5, 0, 0],
        });
        expect(after.getPermutation().getToken("theme.text")?.references[0]?.pointsToToken).toBe(
            after.getPermutation().getToken("color.red"),
        );
    });

    it("keeps a group whose tokens are all kept, and makes new one that holds a new token", () => {
        expect(after.getPermutation().getGroup("space")).toBe(
            before.getPermutation().getGroup("space"),
        );
        expect(after.getPermutation().getGroup("theme")).not.toBe(
            before.getPermutation().getGroup("theme"),
        );
    });

    it("keeps the resolver and the sources of files that did not change", () => {
        expect(after.resolver).toBe(before.resolver);
        const space = (tokens: typeof before) =>
            tokens.sources.find(({ file }) => file === "space.json");
        expect(space(after)).toBe(space(before));
    });

    it("gives a kept place where it is in the new read's text", () => {
        const place = after.getPermutation().getToken("space.md")?.winningDefinition;
        if (!place) throw new Error("space.md is not read");
        const span = getSpan(after, place);
        const text = after.getText("space.json") ?? "";
        expect(JSON.parse(text.slice(span.offset, span.offset + span.length))).toStrictEqual({
            $value: 8,
        });
    });

    it("keeps a token above the edit in the file that changed", () => {
        const blue = before.reread({
            "colors.json": JSON.stringify({
                color: { $type: "color", red: { $value: rgb(1) }, blue: { $value: rgb(0.5) } },
            }),
        });
        expect(blue.getPermutation().getToken("color.red")).toBe(
            before.getPermutation().getToken("color.red"),
        );
        expect(blue.getPermutation().getToken("color.blue")).not.toBe(
            before.getPermutation().getToken("color.blue"),
        );
    });

    it("leaves the read it started from as it was", () => {
        expect(before.getPermutation().getToken("color.red")?.resolved).toMatchObject({
            components: [1, 0, 0],
        });
        expect(before.getPermutation().getToken("theme.text")?.references[0]?.pointsToToken).toBe(
            before.getPermutation().getToken("color.red"),
        );
    });

    it("still reports the problems in a file that did not change", () => {
        const broken = readFromMemory({
            files: {
                "tokens.resolver.json": JSON.stringify({
                    version: "2025.10",
                    resolutionOrder: [
                        {
                            type: "set",
                            name: "base",
                            sources: [{ $ref: "space.json" }, { $ref: "broken.json" }],
                        },
                    ],
                }),
                "space.json": files["space.json"],
                "broken.json": JSON.stringify({ gap: { $type: "number", $value: "{missing}" } }),
            },
            entryFile: "tokens.resolver.json",
        });
        const again = broken.reread({
            "space.json": JSON.stringify({ space: { $type: "number", sm: { $value: 2 } } }),
        });
        const found = (tokens: typeof before) =>
            tokens.diagnostics.map(({ kind, span }) => ({ kind, span }));
        expect(found(broken)).toContainEqual(
            expect.objectContaining({ kind: "missing-reference" }),
        );
        expect(found(again)).toStrictEqual(found(broken));
        expect(again.getPermutation().getToken("gap")).toBe(
            broken.getPermutation().getToken("gap"),
        );
    });

    describe("in the file that changed", () => {
        const sizes = (sm: number) =>
            JSON.stringify(
                {
                    size: {
                        $type: "number",
                        sm: { $value: sm },
                        md: { $value: 2 },
                        gap: { $value: "{size.md}" },
                    },
                },
                null,
                2,
            );
        const first = readFromMemory({ files: { "sizes.json": sizes(1) } });
        const second = first.reread({ "sizes.json": sizes(10) });
        const third = second.reread({ "sizes.json": sizes(100) });
        const token = (tokens: typeof first, path: string) =>
            tokens.getPermutation().getToken(path);
        const written = (tokens: typeof first, span: { offset: number; length: number }) =>
            (tokens.getText("sizes.json") ?? "").slice(span.offset, span.offset + span.length);

        it("keeps a token below the edit, though it moved", () => {
            expect(token(second, "size.md")).toBe(token(first, "size.md"));
            expect(token(second, "size.gap")).toBe(token(first, "size.gap"));
            expect(token(second, "size.sm")).not.toBe(token(first, "size.sm"));
        });

        it("gives a kept place and a kept reference where they are now", () => {
            const md = token(second, "size.md");
            const gap = token(second, "size.gap");
            if (!md || !gap?.references[0]) throw new Error("size.md or size.gap is not read");
            expect(
                JSON.parse(written(second, getSpan(second, md.winningDefinition))),
            ).toStrictEqual({
                $value: 2,
            });
            expect(written(second, getSpan(second, gap.references[0]))).toBe('"{size.md}"');
            expect(getSpan(second, md.winningDefinition)).not.toStrictEqual(
                getSpan(first, md.winningDefinition),
            );
        });

        it("keeps it through another reread", () => {
            expect(token(third, "size.md")).toBe(token(first, "size.md"));
        });

        it("gives a kept place's new line when only line breaks above it moved", () => {
            const text =
                '{"a": {"$type": "number", "$value": 1}, "b": {"$type": "number", "$value": 2}}';
            const edited = text.replace(', "b"', ',\n"b"');
            const once = readFromMemory({ files: { "t.json": text } });
            const again = once.reread({ "t.json": edited });
            const fresh = readFromMemory({ files: { "t.json": edited } });
            const spanOfB = (tokens: typeof first) => {
                const place = tokens.getPermutation().getToken("b")?.winningDefinition;
                if (!place) throw new Error("b is not read");
                return getSpan(tokens, place);
            };
            expect(again.getPermutation().getToken("b")).toBe(once.getPermutation().getToken("b"));
            expect(spanOfB(again)).toStrictEqual(spanOfB(fresh));
        });
    });

    it("makes the resolver new when the resolver's text changes", () => {
        const renamed = before.reread({
            "tokens.resolver.json": (files["tokens.resolver.json"] as string).replace(
                '"default":"light"',
                '"default":"dark"',
            ),
        });
        expect(renamed.resolver).not.toBe(before.resolver);
        expect(renamed.getPermutation().input).toStrictEqual({ mode: "dark" });
    });
});

describe("a reread of every file", () => {
    it("gives back the same design tokens when no file's text differs", () => {
        expect(before.rereadAll({ ...files })).toBe(before);
    });

    it("reads a changed file as a reread of that file does", () => {
        const colors = JSON.stringify({
            color: { $type: "color", red: { $value: rgb(0.5) }, blue: { $value: rgb(0) } },
        });
        const all = before.rereadAll({ ...files, "colors.json": colors });

        expect(all).not.toBe(before);
        expect(all.getPermutation().getToken("space.sm")).toBe(
            before.getPermutation().getToken("space.sm"),
        );
        expect(all.getPermutation().getToken("color.red")?.resolved).toStrictEqual(
            after.getPermutation().getToken("color.red")?.resolved,
        );
    });

    it("reads a file left out as deleted", () => {
        const { "dark.json": _dark, ...withoutDark } = files;
        const all = before.rereadAll(withoutDark);

        expect(all.getText("dark.json")).toBeUndefined();
        expect(all.diagnostics.map(({ kind }) => kind)).toStrictEqual(
            before.reread({ "dark.json": null }).diagnostics.map(({ kind }) => kind),
        );
    });
});

describe("a reread and where a deprecation comes from", () => {
    const marked = (inner: object) =>
        JSON.stringify({
            outer: {
                $type: "number",
                $deprecated: "Use gap",
                inner: { ...inner, n: { $value: 1 } },
            },
        });

    it("names the group that now marks a token, though the mark reads the same", () => {
        const first = readFromMemory({
            files: { "tokens.json": marked({ $deprecated: "Use gap" }) },
        });
        const second = first.reread({ "tokens.json": marked({}) });

        expect(first.getPermutation().getToken("outer.inner.n")?.deprecatedByGroup).toBe(
            "outer.inner",
        );
        expect(second.getPermutation().getToken("outer.inner.n")?.deprecated).toBe("Use gap");
        expect(second.getPermutation().getToken("outer.inner.n")?.deprecatedByGroup).toBe("outer");
        expect(second.getPermutation().getGroup("outer.inner")?.deprecatedByGroup).toBe("outer");
    });
});

describe("a reread and a group in a file that didn't change", () => {
    const resolver = JSON.stringify({
        version: "2025.10",
        resolutionOrder: [
            { type: "set", name: "base", sources: [{ $ref: "a.json" }, { $ref: "b.json" }] },
        ],
    });
    const a = (mid: object) =>
        JSON.stringify({ outer: { $type: "number", $deprecated: "Use gap", mid } });

    it("names the group that now marks it, though the mark reads the same", () => {
        const first = readFromMemory({
            files: {
                "tokens.resolver.json": resolver,
                "a.json": a({ $deprecated: "Use gap" }),
                "b.json": JSON.stringify({ outer: { mid: { inner: {} } } }),
            },
            entryFile: "tokens.resolver.json",
        });
        const second = first.reread({ "a.json": a({}) });

        expect(first.getPermutation().getGroup("outer.mid.inner")?.deprecatedByGroup).toBe(
            "outer.mid",
        );
        expect(second.getPermutation().getGroup("outer.mid.inner")?.deprecatedByGroup).toBe(
            "outer",
        );
    });
});
