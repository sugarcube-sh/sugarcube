import { describe, expect, it } from "vitest";
import { pendingKey, pendingKeys } from "../src/store/create-diff-store";
import type { TokenDiffEntry } from "../src/tokens/types";

const entry = (path: string, contexts: string[]): TokenDiffEntry => ({
    path,
    sourcePath: "colors.json",
    contexts,
    from: { $value: "{color.neutral.950}" },
    to: { $value: "{color.amber.950}" },
});

describe("pendingKeys", () => {
    it("scopes a change to the contexts it happened in", () => {
        const keys = pendingKeys([entry("color.neutral.surface.default", ["dark"])]);

        expect(keys.has(pendingKey("color.neutral.surface.default", "dark"))).toBe(true);
        expect(keys.has(pendingKey("color.neutral.surface.default", "light"))).toBe(false);
    });

    it("matches every context when the change is identical in all of them", () => {
        const keys = pendingKeys([entry("panel.radius", [])]);

        expect(keys.has(pendingKey("panel.radius"))).toBe(true);
    });

    it("keys each context of a change that differs per context", () => {
        const keys = pendingKeys([entry("color.neutral.text.normal", ["light", "dark"])]);

        expect([...keys]).toEqual([
            pendingKey("color.neutral.text.normal", "light"),
            pendingKey("color.neutral.text.normal", "dark"),
        ]);
    });

    it("keeps contexts apart for the same path", () => {
        const keys = pendingKeys([entry("color.a", ["light"]), entry("color.b", ["dark"])]);

        expect(keys.has(pendingKey("color.a", "dark"))).toBe(false);
        expect(keys.has(pendingKey("color.b", "dark"))).toBe(true);
    });
});
