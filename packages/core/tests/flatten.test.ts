import { describe, expect, it } from "vitest";
import { ErrorMessages } from "../src/shared/constants/error-messages.js";
import { flatten } from "../src/shared/pipeline/flatten.js";
import type { FlattenedToken } from "../src/types/flatten.js";
import type { TokenTree } from "../src/types/tokens.js";

const isToken = (entry: unknown): entry is FlattenedToken =>
    entry !== null && typeof entry === "object" && "$value" in entry;

const buildTree = (
    tokens: TokenTree["tokens"],
    options: { sourcePath?: string; context?: string } = {}
): TokenTree => ({
    sourcePath: options.sourcePath ?? "test.json",
    ...(options.context && { context: options.context }),
    tokens,
});

describe("flatten", () => {
    describe("basic flattening", () => {
        it("creates dot-separated keys from nested token structure", () => {
            const { tokens } = flatten([
                buildTree({
                    color: {
                        $type: "color",
                        primary: { $value: "#0066cc" },
                    },
                }),
            ]);

            expect(tokens.tokens["color.primary"]).toBeDefined();
            expect(isToken(tokens.tokens["color.primary"])).toBe(true);
        });

        it("preserves token values during flattening", () => {
            const { tokens } = flatten([
                buildTree({
                    color: {
                        $type: "color",
                        primary: { $value: "#0066cc" },
                        secondary: { $value: "#ff6600" },
                    },
                }),
            ]);

            const primary = tokens.tokens["color.primary"];
            const secondary = tokens.tokens["color.secondary"];

            expect(isToken(primary) && primary.$value).toBe("#0066cc");
            expect(isToken(secondary) && secondary.$value).toBe("#ff6600");
        });

        it("inherits $type from parent groups", () => {
            const { tokens } = flatten([
                buildTree({
                    color: {
                        $type: "color",
                        primary: { $value: "#0066cc" },
                    },
                }),
            ]);

            const token = tokens.tokens["color.primary"];
            expect(isToken(token) && token.$type).toBe("color");
        });
    });

    describe("multiple sources", () => {
        it("merges tokens from multiple source files", () => {
            const { tokens } = flatten([
                buildTree(
                    { color: { $type: "color", primary: { $value: "#0066cc" } } },
                    { sourcePath: "colors.json" }
                ),
                buildTree(
                    { button: { $type: "color", background: { $value: "{color.primary}" } } },
                    { sourcePath: "components.json" }
                ),
            ]);

            expect(tokens.tokens["color.primary"]).toBeDefined();
            expect(tokens.tokens["button.background"]).toBeDefined();
        });

        it("later sources override earlier sources for same path", () => {
            const { tokens } = flatten([
                buildTree(
                    { color: { $type: "color", primary: { $value: "#old" } } },
                    { sourcePath: "base.json" }
                ),
                buildTree(
                    { color: { $type: "color", primary: { $value: "#new" } } },
                    { sourcePath: "override.json" }
                ),
            ]);

            const token = tokens.tokens["color.primary"];
            expect(isToken(token) && token.$value).toBe("#new");
        });
    });

    describe("context handling", () => {
        it("prefixes token keys with context name", () => {
            const { tokens } = flatten([
                buildTree(
                    { color: { $type: "color", primary: { $value: "#000" } } },
                    { context: "dark" }
                ),
            ]);

            expect(tokens.tokens["dark.color.primary"]).toBeDefined();
            expect(tokens.tokens["color.primary"]).toBeUndefined();
        });

        it("keeps base tokens (no context) unprefixed", () => {
            const { tokens } = flatten([
                buildTree({ color: { $type: "color", primary: { $value: "#fff" } } }),
            ]);

            expect(tokens.tokens["color.primary"]).toBeDefined();
        });

        it("separates tokens by context into distinct keys", () => {
            const { tokens } = flatten([
                buildTree(
                    { color: { $type: "color", primary: { $value: "#fff" } } },
                    { sourcePath: "base.json" }
                ),
                buildTree(
                    { color: { $type: "color", primary: { $value: "#000" } } },
                    { context: "dark", sourcePath: "dark.json" }
                ),
                buildTree(
                    { color: { $type: "color", primary: { $value: "#00f" } } },
                    { context: "ocean", sourcePath: "ocean.json" }
                ),
            ]);

            const base = tokens.tokens["color.primary"];
            const dark = tokens.tokens["dark.color.primary"];
            const ocean = tokens.tokens["ocean.color.primary"];

            expect(isToken(base) && base.$value).toBe("#fff");
            expect(isToken(dark) && dark.$value).toBe("#000");
            expect(isToken(ocean) && ocean.$value).toBe("#00f");
        });
    });

    describe("pathIndex", () => {
        it("maps original paths to namespaced keys for lookups", () => {
            const { tokens } = flatten([
                buildTree(
                    { color: { $type: "color", primary: { $value: "#000" } } },
                    { context: "dark" }
                ),
            ]);

            expect(tokens.pathIndex.get("color.primary")).toBe("dark.color.primary");
        });

        it("allows looking up tokens by original path regardless of context", () => {
            const { tokens } = flatten([
                buildTree(
                    { color: { $type: "color", primary: { $value: "#000" } } },
                    { context: "dark" }
                ),
            ]);

            const namespacedKey = tokens.pathIndex.get("color.primary");
            const token = namespacedKey ? tokens.tokens[namespacedKey] : undefined;

            expect(isToken(token) && token.$value).toBe("#000");
        });
    });

    describe("$root token support", () => {
        it("recognizes $root as a valid token name within groups", () => {
            const { tokens, errors } = flatten([
                buildTree({
                    accent: {
                        $type: "color",
                        $root: { $value: "#dd0000" },
                        light: { $value: "#ff6666" },
                    },
                }),
            ]);

            expect(errors).toHaveLength(0);
            expect(tokens.tokens["accent.$root"]).toBeDefined();
            expect(tokens.tokens["accent.light"]).toBeDefined();
        });

        it("creates correct path for $root tokens", () => {
            const { tokens } = flatten([
                buildTree({
                    accent: {
                        $type: "color",
                        $root: { $value: "#dd0000" },
                    },
                }),
            ]);

            const rootToken = tokens.tokens["accent.$root"];
            expect(isToken(rootToken) && rootToken.$path).toBe("accent.$root");
        });

        it("preserves $root token value", () => {
            const { tokens } = flatten([
                buildTree({
                    accent: {
                        $type: "color",
                        $root: { $value: "#dd0000" },
                    },
                }),
            ]);

            const rootToken = tokens.tokens["accent.$root"];
            expect(isToken(rootToken) && rootToken.$value).toBe("#dd0000");
        });

        it("inherits $type from parent group for $root tokens", () => {
            const { tokens } = flatten([
                buildTree({
                    accent: {
                        $type: "color",
                        $root: { $value: "#dd0000" },
                    },
                }),
            ]);

            const rootToken = tokens.tokens["accent.$root"];
            expect(isToken(rootToken) && rootToken.$type).toBe("color");
        });

        it("allows $root at any nesting level", () => {
            const { tokens, errors } = flatten([
                buildTree({
                    theme: {
                        color: {
                            accent: {
                                $type: "color",
                                $root: { $value: "#dd0000" },
                            },
                        },
                    },
                }),
            ]);

            expect(errors).toHaveLength(0);
            expect(tokens.tokens["theme.color.accent.$root"]).toBeDefined();
        });

        it("handles $root with context prefix", () => {
            const { tokens } = flatten([
                buildTree(
                    {
                        accent: {
                            $type: "color",
                            $root: { $value: "#dd0000" },
                        },
                    },
                    { context: "dark" }
                ),
            ]);

            expect(tokens.tokens["dark.accent.$root"]).toBeDefined();
            expect(tokens.pathIndex.get("accent.$root")).toBe("dark.accent.$root");
        });
    });

    describe("error handling", () => {
        it("rejects token names containing dots", () => {
            const { errors } = flatten([
                buildTree({
                    color: {
                        $type: "color",
                        "invalid.name": { $value: "#ff0000" },
                    },
                }),
            ]);

            expect(errors).toHaveLength(1);
            expect(errors[0]?.message).toBe(
                ErrorMessages.FLATTEN.INVALID_TOKEN_NAME("invalid.name")
            );
        });

        it("rejects tokens using unprefixed value/type properties", () => {
            const { errors } = flatten([
                buildTree({
                    color: {
                        $type: "color",
                        broken: {
                            value: "#ff0000",
                            type: "color",
                        },
                    },
                } as unknown as TokenTree["tokens"]),
            ]);

            expect(errors).toHaveLength(1);
            expect(errors[0]?.message).toBe(
                ErrorMessages.FLATTEN.MISSING_DOLLAR_PREFIX("color.broken")
            );
        });

        it("rejects nested tokens inside a token (invalid nesting)", () => {
            const { errors } = flatten([
                buildTree({
                    parent: {
                        $type: "color",
                        $value: "#ff0000",
                        child: { $value: "#000000" },
                    },
                } as TokenTree["tokens"]),
            ]);

            expect(errors).toHaveLength(1);
            expect(errors[0]?.message).toBe(ErrorMessages.FLATTEN.INVALID_TOKEN_NESTING("parent"));
        });

        it("collects multiple errors while still processing valid tokens", () => {
            const { tokens, errors } = flatten([
                buildTree({
                    valid: { $type: "color", $value: "#ff0000" },
                    invalid1: {
                        $type: "color",
                        $value: "#ff0000",
                        child: { $value: "#000" },
                    },
                    invalid2: {
                        $type: "color",
                        $value: "#ff0000",
                        child: { $value: "#000" },
                    },
                } as TokenTree["tokens"]),
            ]);

            expect(errors).toHaveLength(2);
            expect(errors.map((e) => e.path)).toEqual(["invalid1", "invalid2"]);

            expect(tokens.tokens.valid).toBeDefined();

            expect(tokens.tokens.invalid1).toBeUndefined();
            expect(tokens.tokens.invalid2).toBeUndefined();
        });

        it("includes source path in error details", () => {
            const { errors } = flatten([
                buildTree(
                    { color: { $type: "color", "bad.name": { $value: "#f00" } } },
                    { sourcePath: "problematic-file.json" }
                ),
            ]);

            expect(errors[0]?.source.sourcePath).toBe("problematic-file.json");
        });

        it("rejects tokens with literal values missing $type", () => {
            const { errors } = flatten([
                buildTree({
                    color: {
                        primary: { $value: "#ff0000" },
                    },
                }),
            ]);

            expect(errors).toHaveLength(1);
            expect(errors[0]?.message).toBe(
                ErrorMessages.FLATTEN.TOKEN_MISSING_TYPE("color.primary")
            );
        });

        it("allows reference tokens without $type", () => {
            const { tokens, errors } = flatten([
                buildTree({
                    color: {
                        primary: { $value: "{other.color}" },
                    },
                }),
            ]);

            expect(errors).toHaveLength(0);
            expect(tokens.tokens["color.primary"]).toBeDefined();
        });

        it("allows tokens inheriting $type from parent group", () => {
            const { tokens, errors } = flatten([
                buildTree({
                    color: {
                        $type: "color",
                        primary: { $value: "#ff0000" },
                    },
                }),
            ]);

            expect(errors).toHaveLength(0);
            const token = tokens.tokens["color.primary"];
            expect(isToken(token) && token.$type).toBe("color");
        });
    });
});
