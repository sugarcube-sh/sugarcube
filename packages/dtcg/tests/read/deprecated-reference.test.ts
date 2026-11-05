import { describe, expect, it } from "vitest";
import { type DesignTokens, type Span, readFromMemory } from "../../src/index.js";

const color = { colorSpace: "srgb", components: [0.2, 0.4, 0.8] };

function oneFile(json: unknown): DesignTokens {
    return readFromMemory({ files: { "tokens.json": JSON.stringify(json) } });
}

function deprecatedReferences(tokens: DesignTokens) {
    return tokens.diagnostics.filter(({ kind }) => kind === "deprecated-reference");
}

function written(tokens: DesignTokens, span: Span | undefined): string | undefined {
    if (!span) return undefined;
    return tokens.getText(span.file)?.slice(span.offset, span.offset + span.length);
}

describe("a reference to a deprecated token", () => {
    it("is a warning at the reference, with the reason the token gives", () => {
        const tokens = oneFile({
            color: {
                $type: "color",
                old: { $value: color, $deprecated: "Use color.new" },
                primary: { $value: "{color.old}" },
            },
        });
        const [found, ...rest] = deprecatedReferences(tokens);
        expect(rest).toStrictEqual([]);
        expect(found).toMatchObject({
            severity: "warning",
            message: "`color.old` is deprecated: Use color.new",
            path: "color.primary",
            tags: ["deprecated"],
            detail: { ref: "color.old", reason: "Use color.new" },
        });
        expect(written(tokens, found?.span)).toBe('"{color.old}"');
    });

    it("gives no reason for a token marked `true`", () => {
        const tokens = oneFile({
            color: {
                $type: "color",
                old: { $value: color, $deprecated: true },
                primary: { $value: "{color.old}" },
            },
        });
        expect(deprecatedReferences(tokens).map(({ detail }) => detail)).toStrictEqual([
            { ref: "color.old" },
        ]);
    });

    it("counts a token deprecated by its group, but not one that marks itself `false`", () => {
        const tokens = oneFile({
            color: {
                $type: "color",
                old: {
                    $deprecated: "Use color.new",
                    blue: { $value: color },
                    kept: { $value: color, $deprecated: false },
                },
                a: { $value: "{color.old.blue}" },
                b: { $value: "{color.old.kept}" },
            },
        });
        expect(
            deprecatedReferences(tokens).map(({ path, detail }) => [path, detail]),
        ).toStrictEqual([["color.a", { ref: "color.old.blue", reason: "Use color.new" }]]);
    });

    it("counts a JSON Pointer into a deprecated token's value", () => {
        const tokens = oneFile({
            color: {
                $type: "color",
                old: { $value: color, $deprecated: true },
                tint: {
                    $value: {
                        colorSpace: "srgb",
                        components: [{ $ref: "#/color/old/$value/components/0" }, 0.5, 0.5],
                    },
                },
            },
        });
        const [found] = deprecatedReferences(tokens);
        expect(found?.path).toBe("color.tint");
        expect(found?.detail).toStrictEqual({ ref: "#/color/old/$value/components/0" });
    });

    it("says nothing about a reference to a token that isn't deprecated", () => {
        const tokens = oneFile({
            color: {
                $type: "color",
                blue: { $value: color },
                primary: { $value: "{color.blue}" },
            },
        });
        expect(deprecatedReferences(tokens)).toStrictEqual([]);
    });

    it("is reported only in the permutations where the token is deprecated", () => {
        const tokens = readFromMemory({
            files: {
                "tokens.resolver.json": JSON.stringify({
                    version: "2025.10",
                    resolutionOrder: [
                        { type: "set", name: "base", sources: [{ $ref: "color.json" }] },
                        {
                            type: "modifier",
                            name: "mode",
                            default: "light",
                            contexts: { light: [], dark: [{ $ref: "dark.json" }] },
                        },
                    ],
                }),
                "color.json": JSON.stringify({
                    color: {
                        $type: "color",
                        blue: { $value: color },
                        primary: { $value: "{color.blue}" },
                    },
                }),
                "dark.json": JSON.stringify({
                    color: { blue: { $value: color, $deprecated: "Not in dark" } },
                }),
            },
        });
        expect(
            deprecatedReferences(tokens).map(({ path, permutations }) => [
                path,
                permutations.label,
            ]),
        ).toStrictEqual([["color.primary", "mode: dark"]]);
    });
});

describe("a pointer into its own token's value", () => {
    it("is not reported, since the token is the one deprecated", () => {
        const tokens = oneFile({
            color: {
                $type: "color",
                self: {
                    $deprecated: true,
                    $value: {
                        colorSpace: "srgb",
                        components: [{ $ref: "#/color/self/$value/components/1" }, 0.5, 0.5],
                    },
                },
            },
        });
        expect(tokens.diagnostics).toStrictEqual([]);
    });
});
