import type { ResolvedToken, ResolvedTokens } from "@sugarcube-sh/core/client";
import { describe, expect, it } from "vitest";
import { aliasOptions } from "../src/inspector/node-rows";
import { PathIndex } from "../src/tokens/path-index";
import { resolved } from "./fixtures";

const KIT = resolved(
    { path: "heading.1", value: "{text.4xl}" },
    { path: "heading.2", value: "{text.3xl}" },
    { path: "text.4xl", value: "{size.step.5}" },
    { path: "text.3xl", value: "{size.step.4}" },
    { path: "size.step.5", value: { value: 3, unit: "rem" } },
    { path: "size.step.4", value: { value: 2.25, unit: "rem" } },
    { path: "container.xl", value: { value: 36, unit: "rem" } },
    { path: "border.width.thin", value: { value: 1, unit: "px" } },
    { path: "color.brand.500", value: "#4d7bd9", type: "color" },
);

function optionsFor(map: ResolvedTokens, path: string) {
    const pathIndex = new PathIndex(map);
    const token = pathIndex.readToken(map, path, "default") as ResolvedToken;
    return aliasOptions(token, { pathIndex, resolved: map, context: "default" });
}

describe("aliasOptions", () => {
    it("offers the scale the token already uses", () => {
        const options = optionsFor(KIT, "heading.1");

        expect(options.map((o) => o.value).sort()).toEqual(["text.3xl", "text.4xl"]);
        expect(options.every((o) => o.group === "text")).toBe(true);
    });

    it("does not offer another scale that happens to share shade names", () => {
        const values = optionsFor(KIT, "heading.1").map((o) => o.value);

        expect(values).not.toContain("container.xl");
        expect(values).not.toContain("border.width.thin");
        expect(values).not.toContain("size.step.5");
    });

    it("labels each option with its step, not the whole path", () => {
        expect(
            optionsFor(KIT, "heading.1")
                .map((o) => o.label)
                .sort(),
        ).toEqual(["3xl", "4xl"]);
    });

    it("follows the chain to the size that is actually held", () => {
        const byValue = new Map(optionsFor(KIT, "heading.1").map((o) => [o.value, o.detail]));

        expect(byValue.get("text.4xl")).toBe("3rem");
        expect(byValue.get("text.3xl")).toBe("2.25rem");
    });

    it("offers only the scale's own steps, not what is nested below them", () => {
        const map = resolved(
            { path: "panel.width", value: "{border.thin}" },
            { path: "border.thin", value: { value: 1, unit: "px" } },
            { path: "border.thick", value: { value: 4, unit: "px" } },
            { path: "border.nested.deep", value: { value: 9, unit: "px" } },
        );

        expect(
            optionsFor(map, "panel.width")
                .map((o) => o.value)
                .sort(),
        ).toEqual(["border.thick", "border.thin"]);
    });

    it("leaves the token itself out", () => {
        const map = resolved(
            { path: "text.4xl", value: "{text.3xl}" },
            { path: "text.3xl", value: { value: 2.25, unit: "rem" } },
        );

        expect(optionsFor(map, "text.4xl").map((o) => o.value)).not.toContain("text.4xl");
    });

    it("offers nothing of another type", () => {
        const map = resolved(
            { path: "panel.gap", value: "{space.md}" },
            { path: "space.md", value: { value: 1, unit: "rem" } },
            { path: "space.label", value: "hidden", type: "string" },
        );

        expect(optionsFor(map, "panel.gap").map((o) => o.value)).toEqual(["space.md"]);
    });
});
