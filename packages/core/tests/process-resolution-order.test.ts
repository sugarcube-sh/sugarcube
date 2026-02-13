import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ErrorMessages } from "../src/constants/error-messages.js";
import { parseResolverDocument } from "../src/resolver/parse-resolver.js";
import { processResolutionOrder } from "../src/resolver/process-resolution-order.js";
import type { ResolverDocument } from "../src/types/resolver.js";
import type { TokenGroup } from "../src/types/dtcg.js";

const fixturesPath = resolve(__dirname, "__fixtures__/resolver");

const getTokenValue = (tokens: Record<string, unknown>, path: string): unknown => {
    const parts = path.split(".");
    let current: unknown = tokens;
    for (const part of parts) {
        if (current === null || typeof current !== "object") return undefined;
        current = (current as Record<string, unknown>)[part];
    }
    if (current === null || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>).$value;
};

const getTokenDescription = (tokens: Record<string, unknown>, path: string): unknown => {
    const parts = path.split(".");
    let current: unknown = tokens;
    for (const part of parts) {
        if (current === null || typeof current !== "object") return undefined;
        current = (current as Record<string, unknown>)[part];
    }
    if (current === null || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>).$description;
};

const buildDoc = {
    withSet: (name: string, tokens: Record<string, unknown>): ResolverDocument => ({
        version: "2025.10",
        resolutionOrder: [{ type: "set", name, sources: [tokens as TokenGroup] }],
    }),

    withSets: (
        sets: Array<{ name: string; tokens: Record<string, unknown> }>
    ): ResolverDocument => ({
        version: "2025.10",
        resolutionOrder: sets.map(({ name, tokens }) => ({
            type: "set" as const,
            name,
            sources: [tokens as TokenGroup],
        })),
    }),

    withModifier: (
        baseTokens: Record<string, unknown>,
        modifier: {
            name: string;
            default?: string;
            contexts: Record<string, Record<string, unknown>[]>;
        }
    ): ResolverDocument => ({
        version: "2025.10",
        resolutionOrder: [
            { type: "set", name: "base", sources: [baseTokens as TokenGroup] },
            {
                type: "modifier",
                name: modifier.name,
                ...(modifier.default && { default: modifier.default }),
                contexts: Object.fromEntries(
                    Object.entries(modifier.contexts).map(([key, values]) => [
                        key,
                        values.map((v) => v as TokenGroup),
                    ])
                ),
            },
        ],
    }),
};

describe("processResolutionOrder", () => {
    describe("set processing", () => {
        it("processes inline token sources", async () => {
            const result = await processResolutionOrder(
                buildDoc.withSet("base", {
                    color: { primary: { $type: "color", $value: "#3b82f6" } },
                }),
                fixturesPath,
                {}
            );

            expect(result.errors).toHaveLength(0);
            expect(getTokenValue(result.tokens, "color.primary")).toBe("#3b82f6");
        });

        it("merges multiple sources with last-wins semantics", async () => {
            const doc: ResolverDocument = {
                version: "2025.10",
                resolutionOrder: [
                    {
                        type: "set",
                        name: "base",
                        sources: [
                            {
                                color: {
                                    primary: { $type: "color", $value: "#first" },
                                    secondary: { $type: "color", $value: "#second" },
                                },
                            },
                            { color: { primary: { $type: "color", $value: "#override" } } },
                        ],
                    },
                ],
            };

            const result = await processResolutionOrder(doc, fixturesPath, {});

            expect(result.errors).toHaveLength(0);
            expect(getTokenValue(result.tokens, "color.primary")).toBe("#override");
            expect(getTokenValue(result.tokens, "color.secondary")).toBe("#second");
        });

        it("processes file references", async () => {
            const parseResult = await parseResolverDocument(
                resolve(fixturesPath, "with-file-refs.resolver.json")
            );

            const result = await processResolutionOrder(parseResult.document, fixturesPath, {
                theme: "light",
            });

            expect(result.errors).toHaveLength(0);
            expect(result.tokens).toHaveProperty("color");
            expect(result.tokens).toHaveProperty("space");
        });

        it("processes multiple sets in declaration order", async () => {
            const result = await processResolutionOrder(
                buildDoc.withSets([
                    {
                        name: "colors",
                        tokens: { color: { primary: { $type: "color", $value: "#blue" } } },
                    },
                    {
                        name: "spacing",
                        tokens: {
                            space: { sm: { $type: "dimension", $value: { value: 8, unit: "px" } } },
                        },
                    },
                ]),
                fixturesPath,
                {}
            );

            expect(result.errors).toHaveLength(0);
            expect(result.tokens).toHaveProperty("color");
            expect(result.tokens).toHaveProperty("space");
            expect(result.sources).toHaveLength(2);
            expect(result.sources.map((s) => s.name)).toEqual(["colors", "spacing"]);
        });
    });

    describe("modifier processing", () => {
        it("applies selected context tokens", async () => {
            const doc = buildDoc.withModifier(
                { color: { background: { $type: "color", $value: "#ffffff" } } },
                {
                    name: "theme",
                    default: "light",
                    contexts: {
                        light: [],
                        dark: [{ color: { background: { $type: "color", $value: "#1a1a1a" } } }],
                    },
                }
            );

            const lightResult = await processResolutionOrder(doc, fixturesPath, { theme: "light" });
            expect(lightResult.errors).toHaveLength(0);
            expect(getTokenValue(lightResult.tokens, "color.background")).toBe("#ffffff");

            const darkResult = await processResolutionOrder(doc, fixturesPath, { theme: "dark" });
            expect(darkResult.errors).toHaveLength(0);
            expect(getTokenValue(darkResult.tokens, "color.background")).toBe("#1a1a1a");
        });

        it("uses default context when no input provided", async () => {
            const doc = buildDoc.withModifier(
                { color: { bg: { $type: "color", $value: "#base" } } },
                {
                    name: "theme",
                    default: "dark",
                    contexts: {
                        light: [],
                        dark: [{ color: { bg: { $type: "color", $value: "#dark" } } }],
                    },
                }
            );

            const result = await processResolutionOrder(doc, fixturesPath, {});

            expect(result.errors).toHaveLength(0);
            expect(getTokenValue(result.tokens, "color.bg")).toBe("#dark");
        });

        it("tracks modifier source metadata", async () => {
            const doc: ResolverDocument = {
                version: "2025.10",
                resolutionOrder: [
                    { type: "set", name: "base", sources: [] },
                    {
                        type: "modifier",
                        name: "theme",
                        default: "light",
                        contexts: { light: [], dark: [{ color: {} }] },
                    },
                ],
            };

            const result = await processResolutionOrder(doc, fixturesPath, { theme: "dark" });

            expect(result.sources).toHaveLength(2);
            expect(result.sources[1]).toEqual({
                path: "#",
                type: "modifier",
                name: "theme",
                context: "dark",
            });
        });
    });

    describe("referenced sets and modifiers", () => {
        it("resolves $ref to root-level sets", async () => {
            const doc: ResolverDocument = {
                version: "2025.10",
                sets: {
                    foundation: {
                        sources: [{ color: { black: { $type: "color", $value: "#000" } } }],
                    },
                },
                resolutionOrder: [{ $ref: "#/sets/foundation" }],
            };

            const result = await processResolutionOrder(doc, fixturesPath, {});

            expect(result.errors).toHaveLength(0);
            expect(getTokenValue(result.tokens, "color.black")).toBe("#000");
        });

        it("resolves $ref to root-level modifiers", async () => {
            const doc: ResolverDocument = {
                version: "2025.10",
                sets: {
                    base: { sources: [{ color: { bg: { $type: "color", $value: "#fff" } } }] },
                },
                modifiers: {
                    theme: {
                        default: "light",
                        contexts: {
                            light: [],
                            dark: [{ color: { bg: { $type: "color", $value: "#000" } } }],
                        },
                    },
                },
                resolutionOrder: [{ $ref: "#/sets/base" }, { $ref: "#/modifiers/theme" }],
            };

            const result = await processResolutionOrder(doc, fixturesPath, { theme: "dark" });

            expect(result.errors).toHaveLength(0);
            expect(getTokenValue(result.tokens, "color.bg")).toBe("#000");
        });
    });

    describe("conflict resolution", () => {
        it("later sets override earlier sets", async () => {
            const result = await processResolutionOrder(
                buildDoc.withSets([
                    {
                        name: "first",
                        tokens: { color: { primary: { $type: "color", $value: "#first" } } },
                    },
                    {
                        name: "second",
                        tokens: { color: { primary: { $type: "color", $value: "#second" } } },
                    },
                ]),
                fixturesPath,
                {}
            );

            expect(result.errors).toHaveLength(0);
            expect(getTokenValue(result.tokens, "color.primary")).toBe("#second");
        });

        it("replaces tokens entirely (no property merging)", async () => {
            const doc: ResolverDocument = {
                version: "2025.10",
                resolutionOrder: [
                    {
                        type: "set",
                        name: "first",
                        sources: [
                            {
                                color: {
                                    primary: {
                                        $type: "color",
                                        $value: "#first",
                                        $description: "First description",
                                    },
                                    secondary: { $type: "color", $value: "#secondary" },
                                },
                            },
                        ],
                    },
                    {
                        type: "set",
                        name: "second",
                        sources: [{ color: { primary: { $type: "color", $value: "#override" } } }],
                    },
                ],
            };

            const result = await processResolutionOrder(doc, fixturesPath, {});

            expect(result.errors).toHaveLength(0);
            expect(getTokenValue(result.tokens, "color.primary")).toBe("#override");
            expect(getTokenDescription(result.tokens, "color.primary")).toBeUndefined();
            expect(getTokenValue(result.tokens, "color.secondary")).toBe("#secondary");
        });
    });

    describe("error handling", () => {
        it("errors when required modifier input is missing", async () => {
            const doc: ResolverDocument = {
                version: "2025.10",
                resolutionOrder: [
                    { type: "modifier", name: "theme", contexts: { light: [], dark: [] } },
                ],
            };

            const result = await processResolutionOrder(doc, fixturesPath, {});

            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]?.message).toBe(
                ErrorMessages.RESOLVER.MISSING_REQUIRED_INPUT("theme")
            );
        });

        it("errors when referenced file does not exist", async () => {
            const doc: ResolverDocument = {
                version: "2025.10",
                resolutionOrder: [
                    { type: "set", name: "base", sources: [{ $ref: "nonexistent.json" }] },
                ],
            };

            const result = await processResolutionOrder(doc, fixturesPath, {});
            const expectedPath = resolve(fixturesPath, "nonexistent.json");

            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]?.message).toBe(
                ErrorMessages.RESOLVER.EXTERNAL_FILE_NOT_FOUND(expectedPath)
            );
        });

        it("errors when resolver document is used as token source", async () => {
            const doc: ResolverDocument = {
                version: "2025.10",
                resolutionOrder: [
                    { type: "set", name: "base", sources: [{ $ref: "simple.resolver.json" }] },
                ],
            };

            const result = await processResolutionOrder(doc, fixturesPath, {});
            const expectedPath = resolve(fixturesPath, "simple.resolver.json");

            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]?.message).toBe(
                ErrorMessages.RESOLVER.RESOLVER_AS_TOKEN_SOURCE(expectedPath)
            );
        });
    });
});
