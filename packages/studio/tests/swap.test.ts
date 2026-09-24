import type { ResolvedTokens } from "@sugarcube-sh/core/client";
import { describe, expect, it } from "vitest";
import { PathIndex } from "../src/tokens/path-index";
import { referencedGroups, swapCandidates, swapRowFor, swapUpdates } from "../src/tokens/swap";
import { resolved } from "./fixtures";

const SHADES = ["50", "100", "200", "500", "600", "900"];

function ramp(name: string) {
    return SHADES.map((shade) => ({
        path: `${name}.${shade}`,
        value: { colorSpace: "oklch", components: [0.5, 0, 0] },
        type: "color",
    }));
}

const STARTER_KIT = resolved(
    ...ramp("color.neutral"),
    ...ramp("color.slate"),
    ...ramp("color.green"),
    { path: "color.white", value: "#ffffff", type: "color" },
    { path: "color.neutral.text.normal", value: "{color.neutral.900}", type: "color" },
    { path: "color.neutral.text.quiet", value: "{color.neutral.600}", type: "color" },
    { path: "color.neutral.text.quieter", value: "{color.neutral.500}", type: "color" },
    { path: "color.neutral.surface.lowered", value: "{color.neutral.100}", type: "color" },
    { path: "color.neutral.surface.lowest", value: "{color.neutral.200}", type: "color" },
    { path: "color.neutral.surface.default", value: "{color.white}", type: "color" },
);

function harness(tokens: ResolvedTokens) {
    const pathIndex = new PathIndex(tokens);
    const read = (path: string, context?: string) => pathIndex.readValue(tokens, path, context);
    const readType = (path: string, context?: string) =>
        pathIndex.readToken(tokens, path, context)?.$type;
    return { pathIndex, read, readType, contexts: pathIndex.contexts };
}

describe("referencedGroups", () => {
    it("collects what a family points at, keyed by where it points", () => {
        const { pathIndex, read, contexts } = harness(STARTER_KIT);

        expect(referencedGroups("color.neutral", read, pathIndex, contexts)).toEqual([
            { group: "color.neutral", shades: ["900", "600", "500", "100", "200"], count: 5 },
            { group: "color", shades: ["white"], count: 1 },
        ]);
    });

    it("ignores the ramp steps sharing the family's path, because they point at nothing", () => {
        const { pathIndex, read, contexts } = harness(STARTER_KIT);
        const groups = referencedGroups("color.neutral", read, pathIndex, contexts);

        // color.neutral.500 is a colour, not a reference, so no entry claims it.
        expect(groups.flatMap((g) => g.shades)).not.toContain("neutral");
    });

    it("finds nothing in a group of literals", () => {
        const { pathIndex, read, contexts } = harness(
            resolved(
                { path: "color.bg", value: "#FAF9F5", type: "color" },
                { path: "color.primary", value: "#c96442", type: "color" },
            ),
        );

        expect(referencedGroups("color", read, pathIndex, contexts)).toEqual([]);
    });
});

describe("swapCandidates", () => {
    it("offers the groups holding every shade in use", () => {
        const { pathIndex, readType } = harness(STARTER_KIT);

        expect(swapCandidates(["900", "600", "500"], pathIndex, readType).sort()).toEqual([
            "color.green",
            "color.neutral",
            "color.slate",
        ]);
    });

    it("excludes a group missing even one shade", () => {
        const { pathIndex, readType } = harness(
            resolved(
                ...ramp("color.neutral"),
                { path: "color.partial.500", value: "#000", type: "color" },
                { path: "color.partial.600", value: "#000", type: "color" },
            ),
        );

        expect(swapCandidates(["500", "600"], pathIndex, readType)).toContain("color.partial");
        expect(swapCandidates(["500", "600", "900"], pathIndex, readType)).not.toContain(
            "color.partial",
        );
    });
});

describe("swapRowFor", () => {
    it("swaps the ramp, and the lone reference to white does not count against it", () => {
        const { pathIndex, read, readType, contexts } = harness(STARTER_KIT);
        const row = swapRowFor("color.neutral", read, readType, pathIndex, contexts);

        expect(row?.current).toBe("color.neutral");
        expect(row?.candidates.sort()).toEqual(["color.green", "color.neutral", "color.slate"]);
    });

    it("offers nothing when the group references nothing", () => {
        const { pathIndex, read, readType, contexts } = harness(
            resolved({ path: "color.bg", value: "#FAF9F5", type: "color" }),
        );

        expect(swapRowFor("color", read, readType, pathIndex, contexts)).toBeUndefined();
    });

    it("offers nothing when the only group that fits is the one already in use", () => {
        const { pathIndex, read, readType, contexts } = harness(
            resolved(
                { path: "theme.surface.default", value: "#fff", type: "color" },
                { path: "theme.surface.raised", value: "#eee", type: "color" },
                { path: "color.surface.default", value: "{theme.surface.default}", type: "color" },
                { path: "color.surface.raised", value: "{theme.surface.raised}", type: "color" },
            ),
        );

        expect(swapRowFor("color.surface", read, readType, pathIndex, contexts)).toBeUndefined();
    });

    it("offers nothing when the group uses two ramps that both have alternatives", () => {
        const { pathIndex, read, readType, contexts } = harness(TWO_RAMPS);

        expect(swapRowFor("color.text", read, readType, pathIndex, contexts)).toBeUndefined();
    });

    it("offers nothing for a group of dimensions, however well the names line up", () => {
        const { pathIndex, read, readType, contexts } = harness(
            resolved(
                { path: "heading.1", value: "{text.4xl}", type: "dimension" },
                { path: "heading.2", value: "{text.3xl}", type: "dimension" },
                { path: "text.4xl", value: { value: 3, unit: "rem" }, type: "dimension" },
                { path: "text.3xl", value: { value: 2, unit: "rem" }, type: "dimension" },
                { path: "radius.4xl", value: { value: 2, unit: "rem" }, type: "dimension" },
                { path: "radius.3xl", value: { value: 1.5, unit: "rem" }, type: "dimension" },
                { path: "container.4xl", value: { value: 96, unit: "rem" }, type: "dimension" },
                { path: "container.3xl", value: { value: 80, unit: "rem" }, type: "dimension" },
            ),
        );

        expect(swapRowFor("heading", read, readType, pathIndex, contexts)).toBeUndefined();
    });

    it("ignores a group's non-colour references when counting how many ramps it uses", () => {
        const { pathIndex, read, readType, contexts } = harness(
            resolved(
                { path: "panel.border-color", value: "{color.slate.500}", type: "color" },
                { path: "panel.background", value: "{color.slate.50}", type: "color" },
                { path: "panel.radius", value: "{radius.lg}", type: "dimension" },
                { path: "panel.inner-radius", value: "{radius.md}", type: "dimension" },
                { path: "color.slate.500", value: "#64748b", type: "color" },
                { path: "color.slate.50", value: "#f8fafc", type: "color" },
                { path: "color.zinc.500", value: "#71717a", type: "color" },
                { path: "color.zinc.50", value: "#fafafa", type: "color" },
                { path: "radius.lg", value: { value: 1, unit: "rem" }, type: "dimension" },
                { path: "radius.md", value: { value: 0.5, unit: "rem" }, type: "dimension" },
                { path: "corner.lg", value: { value: 1, unit: "rem" }, type: "dimension" },
                { path: "corner.md", value: { value: 0.5, unit: "rem" }, type: "dimension" },
            ),
        );

        const row = swapRowFor("panel", read, readType, pathIndex, contexts);
        expect(row?.current).toBe("color.slate");
        expect(row?.candidates.sort()).toEqual(["color.slate", "color.zinc"]);
    });

    it("offers nothing when most of a group agrees but not all of it", () => {
        const { pathIndex, read, readType, contexts } = harness(
            resolved(
                ...ramp("color.neutral"),
                ...ramp("color.brand"),
                { path: "color.surface.default", value: "{color.neutral.50}", type: "color" },
                { path: "color.surface.raised", value: "{color.neutral.100}", type: "color" },
                { path: "color.surface.sunken", value: "{color.neutral.200}", type: "color" },
                { path: "color.surface.brand", value: "{color.brand.600}", type: "color" },
            ),
        );

        expect(swapRowFor("color.surface", read, readType, pathIndex, contexts)).toBeUndefined();
    });

    it("offers nothing where only one token points anywhere", () => {
        const { pathIndex, read, readType, contexts } = harness(
            resolved(
                { path: "focus.ring.color", value: "{color.slate.500}", type: "color" },
                { path: "focus.ring.offset", value: { value: 4, unit: "px" }, type: "dimension" },
                { path: "focus.ring.width", value: { value: 2, unit: "px" }, type: "dimension" },
                { path: "color.slate.500", value: "#64748b", type: "color" },
                { path: "color.zinc.500", value: "#71717a", type: "color" },
            ),
        );

        expect(swapRowFor("focus.ring", read, readType, pathIndex, contexts)).toBeUndefined();
    });

    it("does not offer a colour group a dimension group with the same shade names", () => {
        const { pathIndex, readType } = harness(
            resolved(
                ...ramp("color.brand"),
                ...SHADES.map((shade) => ({
                    path: `space.${shade}`,
                    value: { value: 1, unit: "rem" },
                    type: "dimension",
                })),
            ),
        );

        expect(swapCandidates(SHADES, pathIndex, readType)).toEqual(["color.brand"]);
    });

    it("offers nothing on a root holding both the ramps and the roles", () => {
        const { pathIndex, read, readType, contexts } = harness(TWO_RAMPS);

        expect(swapRowFor("color", read, readType, pathIndex, contexts)).toBeUndefined();
    });
});

const TWO_RAMPS = resolved(
    ...ramp("color.neutral"),
    ...ramp("color.brand"),
    { path: "color.text.default", value: "{color.neutral.900}", type: "color" },
    { path: "color.text.muted", value: "{color.neutral.600}", type: "color" },
    { path: "color.text.brand", value: "{color.brand.500}", type: "color" },
    { path: "color.text.onBrand", value: "{color.brand.50}", type: "color" },
);

describe("scoping updates by the baseline", () => {
    it("moves only the row's own references, leaving the other ramp's alone", () => {
        const { pathIndex, read, contexts } = harness(TWO_RAMPS);

        const updates = swapUpdates(
            "color.text",
            "color.neutral",
            "color.brand",
            read,
            read,
            pathIndex,
            contexts,
        );

        expect(updates.map((u) => u.path).sort()).toEqual([
            "color.text.default",
            "color.text.muted",
        ]);
    });

    it("discards back to the authored ramp without dragging the other row with it", () => {
        const { pathIndex, contexts } = harness(TWO_RAMPS);
        const baselineRead = (p: string, c?: string) => pathIndex.readValue(TWO_RAMPS, p, c);

        const swapped: ResolvedTokens = { ...TWO_RAMPS };
        for (const [key, token] of Object.entries(swapped)) {
            const value = (token as { $value: unknown }).$value;
            if (typeof value === "string" && value.startsWith("{color.neutral.")) {
                swapped[key] = {
                    ...(token as object),
                    $value: value.replace("{color.neutral.", "{color.brand."),
                } as ResolvedTokens[string];
            }
        }
        const currentRead = (p: string, c?: string) => pathIndex.readValue(swapped, p, c);

        const updates = swapUpdates(
            "color.text",
            "color.neutral",
            "color.neutral",
            currentRead,
            baselineRead,
            pathIndex,
            contexts,
        );

        expect(updates.map((u) => u.path).sort()).toEqual([
            "color.text.default",
            "color.text.muted",
        ]);
        expect(updates.map((u) => u.value)).toEqual(["{color.neutral.900}", "{color.neutral.600}"]);
    });
});

describe("permutation contexts", () => {
    it("swaps a token in every context, including two that hold the same reference", () => {
        const tokens = resolved(
            ...ramp("color.neutral"),
            ...ramp("color.brand"),
            {
                path: "color.text.subtle",
                value: "{color.neutral.500}",
                context: "default",
                type: "color",
            },
            {
                path: "color.text.subtle",
                value: "{color.neutral.500}",
                context: "dark",
                type: "color",
            },
            {
                path: "color.text.default",
                value: "{color.neutral.900}",
                context: "default",
                type: "color",
            },
            {
                path: "color.text.default",
                value: "{color.neutral.50}",
                context: "dark",
                type: "color",
            },
        );
        const { pathIndex, read, contexts } = harness(tokens);

        const updates = swapUpdates(
            "color.text",
            "color.neutral",
            "color.brand",
            read,
            read,
            pathIndex,
            contexts,
        );

        const subtle = updates.filter((u) => u.path === "color.text.subtle");
        expect(subtle.map((u) => u.context).sort()).toEqual(["dark", "default"]);
        expect(updates).toHaveLength(4);
    });
});

describe("swapUpdates", () => {
    it("repoints the references that land in the old group, keeping the shade", () => {
        const { pathIndex, read, contexts } = harness(STARTER_KIT);
        const updates = swapUpdates(
            "color.neutral",
            "color.neutral",
            "color.green",
            read,
            read,
            pathIndex,
            contexts,
        );

        expect(updates).toContainEqual({
            path: "color.neutral.text.normal",
            value: "{color.green.900}",
            context: "default",
        });
        expect(updates).toContainEqual({
            path: "color.neutral.surface.lowest",
            value: "{color.green.200}",
            context: "default",
        });
    });

    it("leaves a reference pointing outside the old group alone", () => {
        const { pathIndex, read, contexts } = harness(STARTER_KIT);
        const updates = swapUpdates(
            "color.neutral",
            "color.neutral",
            "color.green",
            read,
            read,
            pathIndex,
            contexts,
        );

        expect(updates.map((u) => u.path)).not.toContain("color.neutral.surface.default");
    });

    it("leaves the ramp's own colours alone", () => {
        const { pathIndex, read, contexts } = harness(STARTER_KIT);
        const updates = swapUpdates(
            "color.neutral",
            "color.neutral",
            "color.green",
            read,
            read,
            pathIndex,
            contexts,
        );

        expect(updates.map((u) => u.path)).not.toContain("color.neutral.500");
    });

    it("does nothing when the target is the group already in use", () => {
        const { pathIndex, read, contexts } = harness(STARTER_KIT);

        expect(
            swapUpdates(
                "color.neutral",
                "color.neutral",
                "color.neutral",
                read,
                read,
                pathIndex,
                contexts,
            ),
        ).toEqual([]);
    });
});
