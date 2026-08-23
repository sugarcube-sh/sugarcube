import type {
    PanelBinding,
    PanelSection,
    ResolvedTokens,
    StudioConfig,
} from "@sugarcube-sh/core/client";
import { describe, expect, it } from "vitest";
import { expand, withSectionDefaults } from "../src/rows/expand";
import { paletteRamps } from "../src/tokens/palettes";
import type { ResolveContext } from "../src/rows/types";
import { PathIndex } from "../src/tokens/path-index";
import type { TokenSnapshot } from "../src/tokens/types";
import { resolved, snapshot } from "./fixtures";

const COLOR_BINDING = {
    type: "alias",
    token: "color.surface.*",
    from: "colorScale",
} as PanelBinding;

const COLOR_SCALE: StudioConfig["colorScale"] = {
    palettes: ["color.neutral", "color.pink"],
    steps: ["100", "500"],
};

const PALETTE_TOKENS = [
    "color.neutral.100",
    "color.neutral.500",
    "color.pink.100",
    "color.pink.500",
];

function rampCtx(map: ResolvedTokens) {
    return { pathIndex: new PathIndex(map), resolved: map, context: "default" };
}

function ctxFor(...paths: string[]): ResolveContext {
    const all = [...PALETTE_TOKENS, ...paths];
    const map = resolved(...all.map((path) => ({ path, value: "#000", type: "color" })));
    const base = snapshot({ resolved: map }) as TokenSnapshot;

    return {
        baseline: base,
        pathIndex: new PathIndex(map),
        context: "default",
        colorScale: COLOR_SCALE,
        resolved: map,
    };
}

describe("expand", () => {
    it("fans a glob colour binding out to one row per match, labelled by last segment", () => {
        const ctx = ctxFor("color.surface.default", "color.surface.raised", "color.text.body");
        const binding = {
            type: "alias",
            token: "color.surface.*",
            from: "colorScale",
        } as PanelBinding;

        const rows = expand(binding, ctx);

        expect(rows.map((r) => r.label)).toEqual(["default", "raised"]);
        expect(rows.map((r) => r.key)).toEqual([
            "color.surface.default:alias",
            "color.surface.raised:alias",
        ]);
        expect(rows.every((r) => r.controls[0]?.editor === "color")).toBe(true);
    });

    it("gives a colour row one ramp per palette", () => {
        const ctx = ctxFor("color.surface.default");
        const binding = {
            type: "alias",
            token: "color.surface.*",
            from: "colorScale",
        } as PanelBinding;

        const control = expand(binding, ctx)[0]?.controls[0];
        const ramps = control?.editor === "color" ? control.props.ramps : [];

        expect(ramps.map((r) => r.name)).toEqual(["neutral", "pink"]);
        expect(ramps[0]?.steps.map((s) => s.value)).toEqual([
            "color.neutral.100",
            "color.neutral.500",
        ]);
        expect(ramps[0]?.steps[0]?.css).toBe("#000");
    });

    it("does not treat white and black as special", () => {
        const ctx = ctxFor("color.surface.default", "color.white", "color.black");
        const binding = {
            type: "alias",
            token: "color.surface.*",
            from: "colorScale",
        } as PanelBinding;

        const control = expand(binding, ctx)[0]?.controls[0];
        const ramps = control?.editor === "color" ? control.props.ramps : [];
        const values = ramps.flatMap((r) => r.steps.map((s) => s.value));

        expect(values).not.toContain("color.white");
        expect(values).not.toContain("color.black");
    });

    it("handles palettes of different lengths, and never offers a step that does not exist", () => {
        const map = resolved(
            ...["color.neutral.100", "color.neutral.500", "color.pink.500"].map((path) => ({
                path,
                value: "#000",
                type: "color",
            })),
        );
        const ramps = paletteRamps(COLOR_SCALE!, rampCtx(map));

        expect(ramps.map((r) => r.steps.length)).toEqual([2, 1]);
        expect(ramps[1]?.steps.map((s) => s.step)).toEqual(["500"]);
    });

    it("ignores nested groups under a palette", () => {
        const map = resolved(
            ...["color.neutral.100", "color.neutral.alpha.100"].map((path) => ({
                path,
                value: "#000",
                type: "color",
            })),
        );
        const ramps = paletteRamps({ ...COLOR_SCALE!, palettes: ["color.neutral"] }, rampCtx(map));

        expect(ramps[0]?.steps.map((s) => s.value)).toEqual(["color.neutral.100"]);
    });

    it("keeps a non-glob binding as a single row using the binding's own label", () => {
        const ctx = ctxFor("panel.border-width", "border.width.sm");
        const binding = {
            type: "alias",
            token: "panel.border-width",
            options: "border.width.*",
            label: "Panels",
        } as PanelBinding;

        const rows = expand(binding, ctx);

        expect(rows).toHaveLength(1);
        expect(rows[0]?.label).toBe("Panels");
        expect(rows[0]?.controls[0]?.editor).toBe("picker");
    });

    it("produces a single switch row for a scale-linked binding", () => {
        const ctx = ctxFor("container.sm");
        const binding = {
            type: "link",
            token: "container.*",
            scalesWith: "size.step.*",
            label: "scale containers with type",
        } as PanelBinding;

        const rows = expand(binding, ctx);

        expect(rows).toHaveLength(1);
        expect(rows[0]?.label).toBe("scale containers with type");
        expect(rows[0]?.controls[0]?.editor).toBe("switch");
    });

    it("produces one palette-swap row carrying a ramp per option", () => {
        const ctx = ctxFor("color.neutral.100");
        const binding = {
            type: "palette-swap",
            family: "color.neutral",
            label: "Base",
        } as PanelBinding;

        const rows = expand(binding, ctx);
        const control = rows[0]?.controls[0];
        const options = control?.editor === "picker" ? control.props.options : [];

        expect(rows).toHaveLength(1);
        expect(rows[0]?.label).toBe("Base");
        expect(options.map((o) => o.value)).toEqual(["neutral", "pink"]);
        expect(paletteRamps(COLOR_SCALE!, ctx)[0]?.steps.map((s) => s.css)).toEqual([
            "#000",
            "#000",
        ]);
    });

    it("still produces non-colour rows when the config has no colorScale", () => {
        const ctx = { ...ctxFor("panel.border-width", "border.width.sm"), colorScale: undefined };

        const preset = expand(
            {
                type: "alias",
                token: "panel.border-width",
                options: "border.width.*",
                label: "Panels",
            } as PanelBinding,
            ctx,
        );
        const color = expand(COLOR_BINDING, ctx);

        expect(preset).toHaveLength(1);
        expect(color).toHaveLength(0);
    });

    it("uses `only` to both filter and order glob matches", () => {
        const ctx = ctxFor("color.surface.default", "color.surface.raised", "color.surface.sunken");
        const binding = {
            type: "alias",
            token: "color.surface.*",
            from: "colorScale",
            only: ["sunken", "default"],
        } as PanelBinding;

        expect(expand(binding, ctx).map((r) => r.label)).toEqual(["sunken", "default"]);
    });

    it("takes glob row labels from `labels`, keyed by last segment", () => {
        const ctx = ctxFor("color.surface.default", "color.surface.raised");
        const binding = {
            type: "alias",
            token: "color.surface.*",
            from: "colorScale",
            labels: { default: "Page" },
        } as PanelBinding;

        expect(expand(binding, ctx).map((r) => r.label)).toEqual(["Page", "raised"]);
    });

    it("inherits editor and options from the section, binding wins", () => {
        const ctx = ctxFor("panel.radius", "form-control.radius", "radius.sm");
        const section = {
            title: "Corners",
            options: "radius.*",
            bindings: [
                { type: "alias", token: "panel.radius", label: "Panels" },
                {
                    type: "alias",
                    token: "form-control.radius",
                    from: "colorScale",
                    label: "Controls",
                },
            ],
        } as PanelSection;

        const rows = section.bindings.flatMap((b) => expand(withSectionDefaults(section, b), ctx));

        expect(rows.map((r) => r.controls[0]?.editor)).toEqual(["picker", "color"]);
    });

    it("gives every row exactly one control", () => {
        const ctx = ctxFor("color.surface.default", "color.surface.raised");
        const rows = expand(COLOR_BINDING, ctx);

        for (const row of rows) expect(row.controls).toHaveLength(1);
    });
});

describe("palette-swap", () => {
    it("speaks bare palette names, not the configured paths", () => {
        const ctx = ctxFor("color.neutral.100");
        const binding = {
            type: "palette-swap",
            family: "color.neutral",
            label: "Base",
        } as PanelBinding;

        const control = expand(binding, ctx)[0]?.controls[0];
        const options = control?.editor === "picker" ? control.props.options : [];

        expect(options.map((o) => o.value)).toEqual(["neutral", "pink"]);
        for (const option of options) expect(option.value).not.toContain(".");
    });
});

describe("leaf palettes", () => {
    const leafCtx = (...paths: string[]) =>
        rampCtx(resolved(...paths.map((path) => ({ path, value: "#000", type: "color" }))));

    it("treats a standalone colour as a ramp of one", () => {
        const ramps = paletteRamps(
            { palettes: ["color.neutral", "color.white"] },
            leafCtx("color.neutral.100", "color.neutral.500", "color.white"),
        );

        expect(ramps.map((r) => r.name)).toEqual(["neutral", "white"]);
        expect(ramps[1]?.steps.map((s) => s.value)).toEqual(["color.white"]);
        expect(ramps[1]?.steps[0]?.step).toBe("white");
    });

    it("prefers children when a path is both a group and a token", () => {
        const ramps = paletteRamps(
            { palettes: ["color.neutral"] },
            leafCtx("color.neutral", "color.neutral.100"),
        );

        expect(ramps[0]?.steps.map((s) => s.value)).toEqual(["color.neutral.100"]);
    });

    it("yields nothing for a path that isn't a token or a group", () => {
        const ramps = paletteRamps({ palettes: ["color.nope"] }, leafCtx("color.neutral.100"));

        expect(ramps[0]?.steps).toEqual([]);
    });
});
