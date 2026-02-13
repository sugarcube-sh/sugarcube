import { describe, expect, it } from "vitest";
import { flatten } from "../src/pipeline/flatten.js";
import type { FlattenedToken } from "../src/types/flatten.js";
import type { TokenTree } from "../src/types/tokens.js";

const isToken = (entry: unknown): entry is FlattenedToken =>
    entry !== null && typeof entry === "object" && "$value" in entry;

const buildTree = (tokens: TokenTree["tokens"], sourcePath: string): TokenTree => ({
    sourcePath,
    tokens,
});

describe("flatten merge behavior", () => {
    describe("same-type overrides", () => {
        it("later source wins when same token path has same type", () => {
            const { tokens, errors } = flatten([
                buildTree(
                    { color: { $type: "color", primary: { $value: "#000000" } } },
                    "first.json"
                ),
                buildTree(
                    { color: { $type: "color", primary: { $value: "#111111" } } },
                    "second.json"
                ),
            ]);

            expect(errors).toHaveLength(0);

            const token = tokens.tokens["color.primary"];
            expect(isToken(token) && token.$value).toBe("#111111");
        });
    });

    describe("token vs group conflicts", () => {
        it("errors when group tries to override existing token", () => {
            const { tokens, errors } = flatten([
                buildTree(
                    { text: { error: { $type: "color", $value: "#cc1a00" } } },
                    "token-first.json"
                ),
                buildTree(
                    {
                        text: {
                            error: {
                                font: { $type: "fontFamily", $value: ["Consolas"] },
                                color: { $type: "color", $value: "#cc1a00" },
                            },
                        },
                    },
                    "group-second.json"
                ),
            ]);

            expect(errors).toHaveLength(1);
            expect(errors[0]?.path).toBe("text.error");

            const token = tokens.tokens["text.error"];
            expect(isToken(token)).toBe(true);
            expect(isToken(token) && token.$value).toBe("#cc1a00");
        });

        it("errors when token tries to override existing group", () => {
            const { tokens, errors } = flatten([
                buildTree(
                    {
                        text: {
                            error: {
                                font: { $type: "fontFamily", $value: ["Consolas"] },
                            },
                        },
                    },
                    "group-first.json"
                ),
                buildTree(
                    { text: { error: { $type: "color", $value: "#cc1a00" } } },
                    "token-second.json"
                ),
            ]);

            expect(errors).toHaveLength(1);
            expect(errors[0]?.path).toBe("text.error");

            // Original group's child token should still exist
            expect(tokens.tokens["text.error.font"]).toBeDefined();
        });
    });

    describe("type mismatch conflicts", () => {
        it("errors when overriding token has incompatible type", () => {
            const { tokens, errors } = flatten([
                buildTree(
                    { space: { sm: { $type: "dimension", $value: { value: 8, unit: "px" } } } },
                    "dimension.json"
                ),
                buildTree({ space: { sm: { $type: "number", $value: 8 } } }, "number.json"),
            ]);

            expect(errors).toHaveLength(1);
            expect(errors[0]?.path).toBe("space.sm");

            const token = tokens.tokens["space.sm"];
            expect(isToken(token) && token.$type).toBe("dimension");
            expect(isToken(token) && token.$value).toEqual({ value: 8, unit: "px" });
        });

        it("allows override when types are compatible (both color)", () => {
            const { tokens, errors } = flatten([
                buildTree(
                    { brand: { primary: { $type: "color", $value: "#ff0000" } } },
                    "red.json"
                ),
                buildTree(
                    { brand: { primary: { $type: "color", $value: "#00ff00" } } },
                    "green.json"
                ),
            ]);

            expect(errors).toHaveLength(0);

            const token = tokens.tokens["brand.primary"];
            expect(isToken(token) && token.$value).toBe("#00ff00");
        });
    });
});
