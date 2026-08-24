import type { PanelSection } from "@sugarcube-sh/core/client";
import { describe, expect, it } from "vitest";
import { indexPanelOwnership } from "../src/store/panel-ownership";
import { PathIndex } from "../src/tokens/path-index";
import { resolved } from "./fixtures";

const tokens = resolved(
    { path: "size.step.0", value: { value: 1, unit: "rem" } },
    { path: "size.step.1", value: { value: 1.2, unit: "rem" } },
    { path: "space.sm", value: { value: 1, unit: "rem" } },
    { path: "color.neutral.text.normal", value: "{color.neutral.900}", type: "color" },
    { path: "color.neutral.surface.raised", value: "{color.neutral.50}", type: "color" },
);

const index = () => new PathIndex(tokens);

const section = (...bindings: PanelSection["bindings"]): PanelSection[] => [
    { title: "Test", bindings },
];

describe("indexPanelOwnership", () => {
    it("gives a declarative binding the paths its pattern covers", () => {
        const { ownedPaths, conflicts } = indexPanelOwnership(
            section({ type: "scale", token: "size.step.*", base: "size.step.0" }),
            index(),
        );

        expect(ownedPaths.get("size.step.*")).toEqual(["size.step.0", "size.step.1"]);
        expect(conflicts).toHaveLength(0);
    });

    it("keeps sections apart", () => {
        const { ownedPaths, conflicts } = indexPanelOwnership(
            [
                {
                    title: "Type scale",
                    bindings: [{ type: "scale", token: "size.step.*", base: "size.step.0" }],
                },
                {
                    title: "Space scale",
                    bindings: [{ type: "scale", token: "space.*", base: "space.sm" }],
                },
            ],
            index(),
        );

        expect(ownedPaths.get("size.step.*")).toEqual(["size.step.0", "size.step.1"]);
        expect(ownedPaths.get("space.*")).toEqual(["space.sm"]);
        expect(conflicts).toHaveLength(0);
    });

    it("names the section a conflicting binding lives in", () => {
        const { conflicts } = indexPanelOwnership(
            [
                {
                    title: "Type scale",
                    bindings: [{ type: "scale", token: "size.step.*", base: "size.step.0" }],
                },
                { title: "Body", bindings: [{ type: "alias", token: "size.step.0" }] },
            ],
            index(),
        );

        expect(conflicts[0]?.owner).toBe('scale binding "size.step.*" in "Type scale"');
        expect(conflicts[0]?.loser).toBe('alias binding "size.step.0" in "Body"');
    });

    it("leaves two imperative writers over one token alone", () => {
        const { conflicts } = indexPanelOwnership(
            section(
                { type: "palette-swap", family: "color.neutral" },
                { type: "alias", token: "color.neutral.text.*" },
            ),
            index(),
        );

        expect(conflicts).toHaveLength(0);
    });

    it("reports an imperative write inside a declarative range", () => {
        const { conflicts } = indexPanelOwnership(
            section(
                { type: "scale", token: "size.step.*", base: "size.step.0" },
                { type: "alias", token: "size.step.0" },
            ),
            index(),
        );

        expect(conflicts).toEqual([
            {
                owner: 'scale binding "size.step.*" in "Test"',
                loser: 'alias binding "size.step.0" in "Test"',
                example: "size.step.0",
                count: 1,
            },
        ]);
    });

    it("groups a conflict per binding pair rather than per path", () => {
        const { conflicts } = indexPanelOwnership(
            section(
                { type: "scale", token: "size.step.*", base: "size.step.0" },
                { type: "alias", token: "size.step.*" },
            ),
            index(),
        );

        expect(conflicts).toHaveLength(1);
        expect(conflicts[0]?.count).toBe(2);
    });

    it("gives overlapping declarative ranges to the first claimant and reports the rest", () => {
        const { ownedPaths, conflicts } = indexPanelOwnership(
            section(
                { type: "scale", token: "size.step.*", base: "size.step.0" },
                { type: "link", token: "size.step.*", scalesWith: "space.*" },
            ),
            index(),
        );

        expect(ownedPaths.get("size.step.*")).toHaveLength(2);
        expect(conflicts).toHaveLength(1);
    });
});
