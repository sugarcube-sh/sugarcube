import { describe, expect, it } from "vitest";
import { loadTreesFromMemory } from "../src/pipeline/load.js";
import type { TokenMemoryData } from "../src/types/load.js";

describe("loadTreesFromMemory", () => {
    it("should load valid JSON content from memory", async () => {
        const data: TokenMemoryData = {
            "test.json": {
                context: undefined,
                content: JSON.stringify({
                    color: {
                        primary: {
                            $value: "#000000",
                            $type: "color",
                        },
                    },
                }),
            },
        };

        const result = await loadTreesFromMemory(data);
        expect(result.errors).toHaveLength(0);
        expect(result.trees).toHaveLength(1);
        expect(result.trees[0]).toEqual({
            context: undefined,
            tokens: {
                color: {
                    primary: {
                        $value: "#000000",
                        $type: "color",
                    },
                },
            },
            sourcePath: "test.json",
        });
    });

    it("should handle invalid JSON content", async () => {
        const data: TokenMemoryData = {
            "test.json": {
                context: undefined,
                content: "invalid json",
            },
        };

        const result = await loadTreesFromMemory(data);
        expect(result.trees).toHaveLength(0);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]?.message).toMatch(/^Invalid JSON in file test\.json: .+$/);
    });

    it("should handle multiple files with different contexts", async () => {
        const data: TokenMemoryData = {
            "base.json": {
                context: undefined,
                content: JSON.stringify({
                    color: {
                        primary: {
                            $value: "#000000",
                            $type: "color",
                        },
                    },
                }),
            },
            "dark.json": {
                context: "dark",
                content: JSON.stringify({
                    color: {
                        primary: {
                            $value: "#ffffff",
                            $type: "color",
                        },
                    },
                }),
            },
        };

        const result = await loadTreesFromMemory(data);
        expect(result.errors).toHaveLength(0);
        expect(result.trees).toHaveLength(2);
        expect(result.trees[0]?.context).toBeUndefined();
        expect(result.trees[1]?.context).toBe("dark");
    });

    it("should sort base tokens before context variants", async () => {
        const data: TokenMemoryData = {
            // Intentionally put dark first to test sorting
            "dark.json": {
                context: "dark",
                content: JSON.stringify({
                    color: { primary: { $value: "#ffffff", $type: "color" } },
                }),
            },
            "base.json": {
                context: undefined,
                content: JSON.stringify({
                    color: { primary: { $value: "#000000", $type: "color" } },
                }),
            },
        };

        const result = await loadTreesFromMemory(data);
        expect(result.errors).toHaveLength(0);
        expect(result.trees).toHaveLength(2);
        expect(result.trees[0]?.context).toBeUndefined();
        expect(result.trees[1]?.context).toBe("dark");
    });
});
