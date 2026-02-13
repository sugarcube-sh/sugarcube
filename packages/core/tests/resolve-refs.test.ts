import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ErrorMessages } from "../src/constants/error-messages.js";
import { parseResolverDocument } from "../src/resolver/parse-resolver.js";
import {
    createResolveContext,
    resolveDocumentReferences,
    resolveReference,
    resolveSources,
} from "../src/resolver/resolve-refs.js";
import type {
    ModifierDefinition,
    ResolverDocument,
    SetDefinition,
    Source,
} from "../src/types/resolver.js";

const fixturesPath = resolve(__dirname, "__fixtures__/resolver");

const emptyDoc = (): ResolverDocument => ({
    version: "2025.10",
    resolutionOrder: [],
});

const buildDoc = {
    withSets: (sets: Record<string, SetDefinition>): ResolverDocument => ({
        ...emptyDoc(),
        sets,
    }),

    withModifiers: (modifiers: Record<string, ModifierDefinition>): ResolverDocument => ({
        ...emptyDoc(),
        modifiers,
    }),

    withResolutionOrder: (
        resolutionOrder: ResolverDocument["resolutionOrder"]
    ): ResolverDocument => ({
        ...emptyDoc(),
        resolutionOrder,
    }),
};

const createTestContext = (doc: ResolverDocument = emptyDoc()) =>
    createResolveContext(doc, fixturesPath);

const isSetDefinition = (value: unknown): value is SetDefinition =>
    value !== null && typeof value === "object" && "sources" in value;

const isModifierDefinition = (value: unknown): value is ModifierDefinition =>
    value !== null && typeof value === "object" && "contexts" in value;

describe("resolveReference", () => {
    describe("same-document references", () => {
        it("resolves #/sets/* references", async () => {
            const doc = buildDoc.withSets({
                foundation: {
                    sources: [{ color: { primary: { $type: "color", $value: "#3b82f6" } } }],
                },
            });

            const result = await resolveReference("#/sets/foundation", createTestContext(doc));

            expect(result.errors).toHaveLength(0);
            expect(result.sourcePath).toBe("#");
            expect(isSetDefinition(result.content)).toBe(true);
            if (isSetDefinition(result.content)) {
                expect(result.content.sources).toHaveLength(1);
            }
        });

        it("resolves #/modifiers/* references", async () => {
            const doc = buildDoc.withModifiers({
                theme: {
                    contexts: {
                        light: [],
                        dark: [{ color: { bg: { $type: "color", $value: "#000" } } }],
                    },
                    default: "light",
                },
            });

            const result = await resolveReference("#/modifiers/theme", createTestContext(doc));

            expect(result.errors).toHaveLength(0);
            expect(isModifierDefinition(result.content)).toBe(true);
        });

        it("errors on undefined set reference", async () => {
            const result = await resolveReference("#/sets/nonexistent", createTestContext());

            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]?.message).toBe(
                ErrorMessages.RESOLVER.UNDEFINED_SET("nonexistent")
            );
        });

        it("errors on #/resolutionOrder/* references", async () => {
            const doc = buildDoc.withResolutionOrder([{ type: "set", name: "test", sources: [] }]);

            const result = await resolveReference("#/resolutionOrder/0", createTestContext(doc));

            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]?.message).toBe(
                ErrorMessages.RESOLVER.INVALID_REFERENCE("#/resolutionOrder/0")
            );
        });

        it("errors on invalid reference format", async () => {
            const result = await resolveReference("#/invalid/path/format", createTestContext());

            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]?.message).toBe(
                ErrorMessages.RESOLVER.INVALID_REFERENCE("#/invalid/path/format")
            );
        });
    });

    describe("file references", () => {
        it("resolves external file references", async () => {
            const result = await resolveReference("tokens/colors.json", createTestContext());

            expect(result.errors).toHaveLength(0);
            expect(result.sourcePath).toContain("tokens/colors.json");
            expect(result.content).toHaveProperty("color");
        });

        it("errors on missing file", async () => {
            const result = await resolveReference("nonexistent.json", createTestContext());
            const expectedPath = resolve(fixturesPath, "nonexistent.json");

            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]?.message).toBe(
                ErrorMessages.RESOLVER.EXTERNAL_FILE_NOT_FOUND(expectedPath)
            );
        });

        it("caches file reads", async () => {
            const context = createTestContext();

            const result1 = await resolveReference("tokens/colors.json", context);
            const result2 = await resolveReference("tokens/colors.json", context);

            expect(result1.errors).toHaveLength(0);
            expect(result2.errors).toHaveLength(0);
            expect(result1.content).toEqual(result2.content);
        });
    });

    describe("file + fragment references", () => {
        it("resolves file#/fragment references", async () => {
            const result = await resolveReference("tokens/colors.json#/color", createTestContext());

            expect(result.errors).toHaveLength(0);
            expect(result.content).toHaveProperty("primary");
            expect(result.content).toHaveProperty("secondary");
        });

        it("errors on invalid fragment path", async () => {
            const result = await resolveReference(
                "tokens/colors.json#/nonexistent",
                createTestContext()
            );

            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]?.message).toBe(
                ErrorMessages.RESOLVER.INVALID_JSON_POINTER(
                    "/nonexistent",
                    `property "nonexistent" not found`
                )
            );
        });
    });

    describe("circular reference detection", () => {
        it("allows direct reference resolution (cycle detected during source resolution)", async () => {
            const doc = buildDoc.withSets({
                a: { sources: [{ $ref: "#/sets/b" }] },
                b: { sources: [{ $ref: "#/sets/a" }] },
            });

            // Direct reference resolves; cycle detected when resolving sources
            const result = await resolveReference("#/sets/a", createTestContext(doc));

            expect(result.errors).toHaveLength(0);
        });

        it("detects self-referential circular reference", async () => {
            const context = createTestContext();
            context.visitedRefs.add("#/sets/self");

            const result = await resolveReference("#/sets/self", context);

            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]?.message).toBe(
                ErrorMessages.RESOLVER.CIRCULAR_REFERENCE("#/sets/self")
            );
        });
    });
});

describe("resolveSources", () => {
    it("resolves array of file references", async () => {
        const sources = [{ $ref: "tokens/colors.json" }, { $ref: "tokens/spacing.json" }];

        const result = await resolveSources(sources, createTestContext());

        expect(result.errors).toHaveLength(0);
        expect(result.resolved).toHaveLength(2);
        expect(result.resolved[0]).toHaveProperty("color");
        expect(result.resolved[1]).toHaveProperty("space");
    });

    it("handles inline sources without $ref", async () => {
        const inlineSource: Source = {
            color: { custom: { $type: "color", $value: "#ff0000" } },
        };

        const result = await resolveSources([inlineSource], createTestContext());

        expect(result.errors).toHaveLength(0);
        expect(result.resolved).toHaveLength(1);
        expect(result.resolved[0]).toEqual(inlineSource);
    });

    it("applies extending properties via shallow merge", async () => {
        const sources = [{ $ref: "tokens/colors.json", extra: { custom: "value" } }];

        const result = await resolveSources(sources, createTestContext());

        expect(result.errors).toHaveLength(0);
        expect(result.resolved).toHaveLength(1);
        expect(result.resolved[0]).toHaveProperty("color");
        expect(result.resolved[0]).toHaveProperty("extra");
    });
});

describe("resolveDocumentReferences", () => {
    const loadFixture = async (filename: string) => {
        const parseResult = await parseResolverDocument(resolve(fixturesPath, filename));
        const nonWarningErrors = parseResult.errors.filter(
            (e) => e.message !== ErrorMessages.RESOLVER.MODIFIER_SINGLE_CONTEXT
        );
        return { parseResult, nonWarningErrors };
    };

    it("resolves all references in a document with file refs", async () => {
        const { parseResult, nonWarningErrors } = await loadFixture("with-file-refs.resolver.json");
        expect(nonWarningErrors).toHaveLength(0);

        const result = await resolveDocumentReferences(parseResult.document, fixturesPath);

        expect(result.errors).toHaveLength(0);
        expect(result.sets).toHaveLength(1);
        expect(result.modifiers).toHaveLength(1);

        const baseSet = result.sets[0];
        expect(baseSet?.name).toBe("base");
        expect(baseSet?.sources).toHaveLength(2);
        expect(baseSet?.sources[0]).toHaveProperty("color");
        expect(baseSet?.sources[1]).toHaveProperty("space");

        const themeModifier = result.modifiers[0];
        expect(themeModifier?.name).toBe("theme");
        expect(themeModifier?.resolvedContexts.light).toHaveLength(0);
        expect(themeModifier?.resolvedContexts.dark).toHaveLength(1);
        expect(themeModifier?.resolvedContexts.dark?.[0]).toHaveProperty("color");
    });

    it("resolves document with same-document refs", async () => {
        const { parseResult } = await loadFixture("with-refs.resolver.json");

        const result = await resolveDocumentReferences(parseResult.document, fixturesPath);

        expect(result.errors).toHaveLength(0);
        expect(result.sets).toHaveLength(1);
        expect(result.modifiers).toHaveLength(1);

        expect(result.sets[0]?.name).toBe("foundation");
        expect(result.modifiers[0]?.name).toBe("theme");
        expect(result.modifiers[0]?.definition.default).toBe("light");
    });

    it("handles inline sets and modifiers", async () => {
        const { parseResult } = await loadFixture("simple.resolver.json");

        const result = await resolveDocumentReferences(parseResult.document, fixturesPath);

        expect(result.sets).toHaveLength(1);
        expect(result.modifiers).toHaveLength(1);
        expect(result.sets[0]?.name).toBe("base");
        expect(result.modifiers[0]?.name).toBe("theme");
    });

    it("handles extending references with shallow merge", async () => {
        const { parseResult } = await loadFixture("with-extending.resolver.json");

        const result = await resolveDocumentReferences(parseResult.document, fixturesPath);

        expect(result.errors).toHaveLength(0);
        expect(result.sets).toHaveLength(1);

        const source = result.sets[0]?.sources[0];
        expect(source).toHaveProperty("color");

        if (source && "color" in source) {
            const colorContent = source.color as Record<string, unknown>;
            expect(colorContent).toHaveProperty("accent");
        }
    });
});
