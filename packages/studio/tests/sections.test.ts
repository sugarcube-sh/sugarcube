import type { ResolvedToken } from "@sugarcube-sh/core/client";
import { describe, expect, it } from "vitest";
import { asPaletteRamp, effectiveValue, groupContent, isAlias } from "../src/tokens/sections";

function token(path: string, value: unknown, type = "color"): ResolvedToken {
    return { $path: path, $value: value, $type: type } as ResolvedToken;
}

function content(tokens: ResolvedToken[]) {
    const byPath = new Map(tokens.map((t) => [t.$path, t]));
    return groupContent(
        tokens.map((t) => t.$path),
        (path: string) => byPath.get(path),
    );
}

describe("isAlias", () => {
    it("recognises a reference", () => {
        expect(isAlias(token("color.text.muted", "{color.neutral.600}"))).toBe(true);
    });

    it("treats a literal object as material", () => {
        expect(isAlias(token("color.brand.500", { hex: "#4d7bd9" }))).toBe(false);
    });

    it("does not mistake a bare string for a reference", () => {
        expect(isAlias(token("typography.font.body", "Inter", "fontFamily"))).toBe(false);
    });
});

describe("groupContent", () => {
    it("splits literals from aliases sharing a parent", () => {
        const { sets, roles } = content([
            token("color.brand.500", { hex: "#4d7bd9" }),
            token("color.brand.on", "{color.brand.50}"),
        ]);
        expect(sets.map((r) => r.name)).toEqual(["brand"]);
        expect(roles.map((r) => r.name)).toEqual(["brand"]);
    });

    it("runs by immediate parent", () => {
        const { sets } = content([
            token("color.brand.500", { hex: "#000" }),
            token("color.neutral.500", { hex: "#111" }),
        ]);
        expect(sets.map((r) => r.name)).toEqual(["brand", "neutral"]);
    });

    it("puts tokens at the group's own level in one unnamed run", () => {
        const { sets } = content([
            token("color.primary", { hex: "#000" }),
            token("color.danger", { hex: "#f00" }),
        ]);
        expect(sets).toHaveLength(1);
        expect(sets[0]?.name).toBe("");
        expect(sets[0]?.tokens).toHaveLength(2);
    });

    it("keeps the full intermediate path for deeply nested tokens", () => {
        const { sets } = content([token("color.button.primary.background.hover", { hex: "#000" })]);
        expect(sets[0]?.name).toBe("button.primary.background");
    });

    it("preserves document order rather than sorting", () => {
        const { sets } = content([
            token("color.zebra.1", { hex: "#000" }),
            token("color.apple.1", { hex: "#111" }),
        ]);
        expect(sets.map((r) => r.name)).toEqual(["zebra", "apple"]);
    });

    it("has no roles when nothing is aliased", () => {
        const { sets, roles } = content([
            token("color.a", { hex: "#000" }),
            token("color.b", { hex: "#111" }),
        ]);
        expect(sets).toHaveLength(1);
        expect(roles).toEqual([]);
    });
});

describe("asPaletteRamp", () => {
    it("labels each step with the token's last segment", () => {
        const { sets } = content([
            token("color.brand.50", { hex: "#000" }),
            token("color.brand.500", { hex: "#111" }),
        ]);
        const ramp = asPaletteRamp(sets[0]!, () => "#abc");
        expect(ramp.name).toBe("brand");
        expect(ramp.steps).toEqual([
            { step: "50", value: "color.brand.50", css: "#abc" },
            { step: "500", value: "color.brand.500", css: "#abc" },
        ]);
    });
});

describe("effectiveValue", () => {
    const tokenWith = (over: Record<string, unknown>) =>
        ({ $path: "radius.md", $type: "dimension", ...over }) as never;

    it("reads $value for a literal, so an edit is not masked by a stale $resolvedValue", () => {
        const edited = tokenWith({
            $value: { value: 0.75, unit: "rem" },
            $resolvedValue: { value: 0.25, unit: "rem" },
        });
        expect(effectiveValue(edited)).toEqual({ value: 0.75, unit: "rem" });
    });

    it("reads $resolvedValue for a reference, which is what it is for", () => {
        const alias = tokenWith({
            $value: "{radius.lg}",
            $resolvedValue: { value: 0.5, unit: "rem" },
        });
        expect(effectiveValue(alias)).toEqual({ value: 0.5, unit: "rem" });
    });

    it("falls back to $value when a reference has no resolved value", () => {
        expect(effectiveValue(tokenWith({ $value: "{radius.missing}" }))).toBe("{radius.missing}");
    });
});
