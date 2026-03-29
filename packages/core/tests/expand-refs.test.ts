import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { expandRefs } from "../src/pipeline/expand-refs.js";
import type { TokenTree } from "../src/types/tokens.js";

const buildTree = (
    tokens: TokenTree["tokens"],
    options: { sourcePath?: string; context?: string } = {}
): TokenTree => ({
    sourcePath: options.sourcePath ?? "test.json",
    ...(options.context && { context: options.context }),
    tokens,
});

describe("expandRefs", () => {
    describe("fast path - no refs", () => {
        it("passes through trees without $ref unchanged", async () => {
            const trees = [
                buildTree({
                    color: {
                        $type: "color",
                        primary: { $value: "#0066cc" },
                    },
                }),
            ];

            const { trees: result, errors } = await expandRefs(trees);

            expect(errors).toHaveLength(0);
            expect(result[0]?.tokens).toEqual(trees[0]?.tokens);
        });
    });

    describe("token $ref - same document", () => {
        it("normalizes token $ref to curly brace format", async () => {
            const trees = [
                buildTree({
                    colors: {
                        $type: "color",
                        blue: { $value: "#0066cc" },
                    },
                    button: {
                        background: { $ref: "#/colors/blue" },
                    },
                }),
            ];

            const { trees: result, errors } = await expandRefs(trees);

            expect(errors).toHaveLength(0);
            const buttonBg = result[0]?.tokens.button as { background: { $value: string } };
            expect(buttonBg.background.$value).toBe("{colors.blue}");
        });

        it("inherits $type from target token", async () => {
            const trees = [
                buildTree({
                    colors: {
                        $type: "color",
                        blue: { $value: "#0066cc" },
                    },
                    button: {
                        background: { $ref: "#/colors/blue" },
                    },
                }),
            ];

            const { trees: result, errors } = await expandRefs(trees);

            expect(errors).toHaveLength(0);
            const buttonBg = result[0]?.tokens.button as { background: { $type: string } };
            expect(buttonBg.background.$type).toBe("color");
        });

        it("resolves deeply nested token refs", async () => {
            const trees = [
                buildTree({
                    theme: {
                        colors: {
                            $type: "color",
                            primary: { $value: "#0066cc" },
                        },
                    },
                    components: {
                        button: {
                            background: { $ref: "#/theme/colors/primary" },
                        },
                    },
                }),
            ];

            const { trees: result, errors } = await expandRefs(trees);

            expect(errors).toHaveLength(0);
            const components = result[0]?.tokens.components as {
                button: { background: { $value: string } };
            };
            expect(components.button.background.$value).toBe("{theme.colors.primary}");
        });

        it("inherits $type from closest parent group, not outermost", async () => {
            const trees = [
                buildTree({
                    colors: {
                        $type: "color",
                        semantic: {
                            $type: "dimension",
                            primary: { $value: "#0066cc" },
                        },
                    },
                    button: {
                        background: { $ref: "#/colors/semantic/primary" },
                    },
                }),
            ];

            const { trees: result, errors } = await expandRefs(trees);

            expect(errors).toHaveLength(0);
            const buttonBg = result[0]?.tokens.button as { background: { $type: string } };
            expect(buttonBg.background.$type).toBe("dimension");
        });

        it("omits $type when no ancestor or target has one", async () => {
            const trees = [
                buildTree({
                    values: {
                        primary: { $value: "#0066cc" },
                    },
                    button: {
                        background: { $ref: "#/values/primary" },
                    },
                }),
            ];

            const { trees: result, errors } = await expandRefs(trees);

            expect(errors).toHaveLength(0);
            const buttonBg = result[0]?.tokens.button as { background: Record<string, unknown> };
            expect(buttonBg.background.$value).toBe("{values.primary}");
            expect(buttonBg.background.$type).toBeUndefined();
        });

        it("preserves $description and $extensions from target", async () => {
            const trees = [
                buildTree({
                    colors: {
                        $type: "color",
                        blue: {
                            $value: "#0066cc",
                            $description: "Primary blue color",
                            $extensions: { "com.example": { category: "brand" } },
                        },
                    },
                    button: {
                        background: { $ref: "#/colors/blue" },
                    },
                }),
            ];

            const { trees: result, errors } = await expandRefs(trees);

            expect(errors).toHaveLength(0);
            const buttonBg = result[0]?.tokens.button as {
                background: { $description: string; $extensions: Record<string, unknown> };
            };
            expect(buttonBg.background.$description).toBe("Primary blue color");
            expect(buttonBg.background.$extensions).toEqual({
                "com.example": { category: "brand" },
            });
        });
    });

    describe("group $ref - same document", () => {
        it("inlines group content at reference location", async () => {
            const trees = [
                buildTree({
                    button: {
                        $type: "color",
                        background: { $value: "#0066cc" },
                        text: { $value: "#ffffff" },
                    },
                    "primary-button": { $ref: "#/button" },
                }),
            ];

            const { trees: result, errors } = await expandRefs(trees);

            expect(errors).toHaveLength(0);
            const primaryButton = result[0]?.tokens["primary-button"] as {
                $type: string;
                background: { $value: string };
                text: { $value: string };
            };
            expect(primaryButton.$type).toBe("color");
            expect(primaryButton.background.$value).toBe("#0066cc");
            expect(primaryButton.text.$value).toBe("#ffffff");
        });

        it("applies overrides to referenced group", async () => {
            const trees = [
                buildTree({
                    button: {
                        $type: "color",
                        background: { $value: "#0066cc" },
                        text: { $value: "#ffffff" },
                    },
                    "danger-button": {
                        $ref: "#/button",
                        background: { $value: "#cc0000" },
                    },
                }),
            ];

            const { trees: result, errors } = await expandRefs(trees);

            expect(errors).toHaveLength(0);
            const dangerButton = result[0]?.tokens["danger-button"] as {
                background: { $value: string };
                text: { $value: string };
            };
            expect(dangerButton.background.$value).toBe("#cc0000");
            expect(dangerButton.text.$value).toBe("#ffffff");
        });
    });

    describe("chained $ref resolution", () => {
        it("follows chained refs without error", async () => {
            const trees = [
                buildTree({
                    colors: {
                        $type: "color",
                        blue: { $value: "#0066cc" },
                    },
                    aliases: {
                        primary: { $ref: "#/colors/blue" },
                    },
                    button: {
                        background: { $ref: "#/aliases/primary" },
                    },
                }),
            ];

            const { trees: result, errors } = await expandRefs(trees);

            expect(errors).toHaveLength(0);
            // $value points to the immediate target
            const buttonBg = result[0]?.tokens.button as { background: { $value: string } };
            expect(buttonBg.background.$value).toBe("{aliases.primary}");
            // aliases.primary itself is expanded to reference colors.blue
            const aliases = result[0]?.tokens.aliases as {
                primary: { $value: string; $type: string };
            };
            expect(aliases.primary.$value).toBe("{colors.blue}");
            expect(aliases.primary.$type).toBe("color");
        });
    });

    describe("JSON Pointer escaping", () => {
        it("handles ~1 encoding for slashes in property names", async () => {
            const trees = [
                buildTree({
                    "my/group": {
                        $type: "color",
                        token: { $value: "#0066cc" },
                    },
                    alias: { $ref: "#/my~1group/token" },
                }),
            ];

            const { trees: result, errors } = await expandRefs(trees);

            expect(errors).toHaveLength(0);
            const alias = result[0]?.tokens.alias as { $value: string };
            expect(alias.$value).toBe("{my/group.token}");
        });

        it("handles ~0 encoding for tildes in property names", async () => {
            const trees = [
                buildTree({
                    "my~group": {
                        $type: "color",
                        token: { $value: "#0066cc" },
                    },
                    alias: { $ref: "#/my~0group/token" },
                }),
            ];

            const { trees: result, errors } = await expandRefs(trees);

            expect(errors).toHaveLength(0);
            const alias = result[0]?.tokens.alias as { $value: string };
            expect(alias.$value).toBe("{my~group.token}");
        });
    });

    describe("circular reference detection", () => {
        it("detects direct circular references", async () => {
            const trees = [buildTree({ a: { $ref: "#/a" } })];

            const { errors } = await expandRefs(trees);

            expect(errors).toHaveLength(1);
            expect(errors[0]?.message).toContain("Circular reference");
        });

        it("detects indirect circular references", async () => {
            const trees = [
                buildTree({
                    a: { $ref: "#/b" },
                    b: { $ref: "#/c" },
                    c: { $ref: "#/a" },
                }),
            ];

            const { errors } = await expandRefs(trees);

            expect(errors.length).toBeGreaterThan(0);
            expect(errors.some((e) => e.message.includes("Circular reference"))).toBe(true);
        });
    });

    describe("error handling", () => {
        it("reports error for invalid JSON pointer", async () => {
            const trees = [buildTree({ button: { $ref: "#/nonexistent/path" } })];

            const { errors } = await expandRefs(trees);

            expect(errors).toHaveLength(1);
            expect(errors[0]?.message).toContain("Invalid JSON pointer");
        });

        it("reports error when $ref points to a primitive value", async () => {
            const trees = [
                buildTree({
                    colors: {
                        $type: "color",
                        blue: { $value: "#0066cc" },
                    },
                    alias: { $ref: "#/colors/blue/$value" },
                }),
            ];

            const { errors } = await expandRefs(trees);

            expect(errors).toHaveLength(1);
            expect(errors[0]?.message).toContain("Invalid");
        });

        it("continues processing valid tokens after errors", async () => {
            const trees = [
                buildTree({
                    colors: { $type: "color", valid: { $value: "#0066cc" } },
                    invalid: { $ref: "#/nonexistent" },
                    other: { $type: "color", working: { $value: "#ff0000" } },
                }),
            ];

            const { trees: result, errors } = await expandRefs(trees);

            expect(errors).toHaveLength(1);
            const colors = result[0]?.tokens.colors as { valid: { $value: string } };
            expect(colors.valid.$value).toBe("#0066cc");
        });
    });

    describe("$root token compatibility", () => {
        it("works with $root tokens", async () => {
            const trees = [
                buildTree({
                    accent: {
                        $type: "color",
                        $root: { $value: "#dd0000" },
                    },
                    button: {
                        background: { $ref: "#/accent/$root" },
                    },
                }),
            ];

            const { trees: result, errors } = await expandRefs(trees);

            expect(errors).toHaveLength(0);
            const buttonBg = result[0]?.tokens.button as { background: { $value: string } };
            expect(buttonBg.background.$value).toBe("{accent.$root}");
        });
    });

    describe("multiple trees", () => {
        it("processes multiple trees independently", async () => {
            const trees = [
                buildTree({
                    colors: { $type: "color", blue: { $value: "#0066cc" } },
                    alias: { $ref: "#/colors/blue" },
                }),
                buildTree({
                    sizes: { $type: "dimension", small: { $value: "8px" } },
                }),
            ];

            const { trees: result, errors } = await expandRefs(trees);

            expect(errors).toHaveLength(0);
            expect(result).toHaveLength(2);

            const alias = result[0]?.tokens.alias as { $value: string };
            expect(alias.$value).toBe("{colors.blue}");

            // Second tree had no refs, should pass through unchanged
            const sizes = result[1]?.tokens.sizes as { small: { $value: string } };
            expect(sizes.small.$value).toBe("8px");
        });

        it("does not resolve cross-tree references", async () => {
            const trees = [
                buildTree({
                    colors: { $type: "color", blue: { $value: "#0066cc" } },
                }),
                buildTree({
                    alias: { $ref: "#/colors/blue" },
                }),
            ];

            const { errors } = await expandRefs(trees);

            expect(errors).toHaveLength(1);
            expect(errors[0]?.message).toContain("Invalid JSON pointer");
        });
    });

    describe("context handling", () => {
        it("preserves context during expansion", async () => {
            const trees = [
                buildTree(
                    {
                        colors: { $type: "color", blue: { $value: "#000066" } },
                        button: { background: { $ref: "#/colors/blue" } },
                    },
                    { context: "dark" }
                ),
            ];

            const { trees: result, errors } = await expandRefs(trees);

            expect(errors).toHaveLength(0);
            expect(result[0]?.context).toBe("dark");
        });
    });
});

describe("expandRefs - external file references", () => {
    const testDir = join(process.cwd(), "tests", "__fixtures__", "tokens", "refs");

    beforeAll(async () => {
        await mkdir(testDir, { recursive: true });

        await writeFile(
            join(testDir, "colors.json"),
            JSON.stringify({
                brand: {
                    $type: "color",
                    primary: { $value: "#0066cc" },
                },
            })
        );

        await writeFile(
            join(testDir, "components.json"),
            JSON.stringify({
                button: {
                    $type: "color",
                    background: { $value: "#0066cc" },
                },
            })
        );
    });

    afterAll(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    it("resolves external file with JSON Pointer fragment", async () => {
        const trees = [
            buildTree(
                { button: { background: { $ref: "colors.json#/brand/primary" } } },
                { sourcePath: join(testDir, "main.json") }
            ),
        ];

        const { trees: result, errors } = await expandRefs(trees);

        expect(errors).toHaveLength(0);
        const buttonBg = result[0]?.tokens.button as { background: { $value: string } };
        expect(buttonBg.background.$value).toBe("{brand.primary}");
    });

    it("resolves external group reference", async () => {
        const trees = [
            buildTree(
                { "primary-button": { $ref: "components.json#/button" } },
                { sourcePath: join(testDir, "main.json") }
            ),
        ];

        const { trees: result, errors } = await expandRefs(trees);

        expect(errors).toHaveLength(0);
        const primaryButton = result[0]?.tokens["primary-button"] as { $type: string };
        expect(primaryButton.$type).toBe("color");
    });

    it("resolves external file ref without fragment (whole file as group)", async () => {
        const trees = [
            buildTree(
                { "all-components": { $ref: "components.json" } },
                { sourcePath: join(testDir, "main.json") }
            ),
        ];

        const { trees: result, errors } = await expandRefs(trees);

        expect(errors).toHaveLength(0);
        const allComponents = result[0]?.tokens["all-components"] as {
            button: { $type: string; background: { $value: string } };
        };
        expect(allComponents.button.$type).toBe("color");
        expect(allComponents.button.background.$value).toBe("#0066cc");
    });

    it("reports error for missing external file", async () => {
        const trees = [
            buildTree(
                { button: { background: { $ref: "nonexistent.json#/colors/blue" } } },
                { sourcePath: join(testDir, "main.json") }
            ),
        ];

        const { errors } = await expandRefs(trees);

        expect(errors).toHaveLength(1);
        expect(errors[0]?.message).toContain("not found");
    });
});
