import { describe, expect, it } from "vitest";
import { userConfigSchema } from "../src/shared/schemas/config.js";

function parsePanel(section: unknown) {
    return userConfigSchema.safeParse({ studio: { panel: [section] } });
}

const issues = (result: ReturnType<typeof parsePanel>) =>
    result.success ? [] : result.error.issues.map((i) => i.message);

describe("panel section schema", () => {
    it("accepts a binding that declares options itself", () => {
        const result = parsePanel({
            title: "Corners",
            bindings: [{ type: "alias", token: "panel.radius", options: "radius.*" }],
        });

        expect(result.success).toBe(true);
    });

    it("accepts a binding that names a source instead", () => {
        const result = parsePanel({
            title: "Surfaces",
            bindings: [{ type: "alias", token: "color.surface.*", from: "colorScale" }],
        });

        expect(result.success).toBe(true);
    });

    it("accepts bindings that inherit their source from the section", () => {
        const result = parsePanel({
            title: "Corners",
            options: "radius.*",
            bindings: [
                { type: "alias", token: "panel.radius", label: "Panels" },
                { type: "alias", token: "form-control.radius", label: "Form controls" },
            ],
        });

        expect(result.success).toBe(true);
    });

    it("rejects a binding with neither, naming the section and token", () => {
        const result = parsePanel({
            title: "Corners",
            bindings: [{ type: "alias", token: "panel.radius" }],
        });

        expect(result.success).toBe(false);
        const message = issues(result).join("\n");
        expect(message).toContain('Panel section "Corners"');
        expect(message).toContain("panel.radius");
        expect(message).toContain("no choices");
    });

    it("rejects a binding with both, since they are alternatives", () => {
        const result = parsePanel({
            title: "Surfaces",
            bindings: [
                {
                    type: "alias",
                    token: "color.surface.*",
                    from: "colorScale",
                    options: "color.neutral.*",
                },
            ],
        });

        expect(result.success).toBe(false);
        expect(issues(result).join("\n")).toContain('both "from" and "options"');
    });

    it("catches the inherited-plus-declared clash too", () => {
        // The section supplies options, the binding adds a source — neither alone is wrong.
        const result = parsePanel({
            title: "Surfaces",
            options: "color.neutral.*",
            bindings: [{ type: "alias", token: "color.surface.*", from: "colorScale" }],
        });

        expect(result.success).toBe(false);
        expect(issues(result).join("\n")).toContain("inherited");
    });

    it("infers nothing from a colour-shaped token", () => {
        const result = parsePanel({
            title: "Surfaces",
            bindings: [{ type: "alias", token: "color.surface.*" }],
        });

        expect(result.success).toBe(false);
        expect(issues(result).join("\n")).toContain("no choices");
    });

    it("does not demand a source from non-alias bindings", () => {
        const result = parsePanel({
            title: "Scale",
            bindings: [
                { type: "scale", token: "size.step.*", base: "size.step.0" },
                { type: "link", token: "container.*", scalesWith: "size.step.*" },
                { type: "palette-swap", family: "color.neutral" },
            ],
        });

        expect(result.success).toBe(true);
    });

    it("no longer accepts the pre-merge binding types or the editor field", () => {
        for (const binding of [
            { type: "color", token: "color.surface.*" },
            { type: "preset", token: "panel.radius", options: "radius.*" },
            { type: "scale-linked", token: "container.*", scalesWith: "size.step.*" },
        ]) {
            expect(parsePanel({ title: "Legacy", bindings: [binding] }).success).toBe(false);
        }
    });
});
