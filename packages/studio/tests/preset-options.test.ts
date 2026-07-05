import { describe, expect, it } from "vitest";
import { resolveOptions } from "../src/controls/preset-options";
import { PathIndex } from "../src/tokens/path-index";
import { resolved } from "./fixtures";

describe("resolveOptions", () => {
    it("passes a record of options through with the key as label and the value as reference", () => {
        const pathIndex = new PathIndex(resolved());

        const options = resolveOptions(
            { small: "{size.step.0}", medium: "{size.step.2}" },
            pathIndex,
            {},
        );

        expect(options).toEqual([
            { key: "small", label: "small", reference: "{size.step.0}" },
            { key: "medium", label: "medium", reference: "{size.step.2}" },
        ]);
    });

    it("returns every match when no option is an alias to another match", () => {
        const baseline = resolved(
            { path: "size.step.0", value: 16 },
            { path: "size.step.1", value: 18 },
            { path: "size.step.2", value: 20 },
        );
        const pathIndex = new PathIndex(baseline);

        const options = resolveOptions("size.step.*", pathIndex, baseline);

        expect(options.map((o) => o.key).sort()).toEqual([
            "size.step.0",
            "size.step.1",
            "size.step.2",
        ]);
    });

    it("drops a match whose reference resolves to another match in the set", () => {
        const baseline = resolved(
            { path: "font.sans", value: "Inter" },
            { path: "font.serif", value: "Georgia" },
            { path: "font.body", value: "{font.sans}" },
        );
        const pathIndex = new PathIndex(baseline);

        const options = resolveOptions("font.*", pathIndex, baseline);

        expect(options.map((o) => o.key).sort()).toEqual(["font.sans", "font.serif"]);
    });

    it("keeps a match whose reference resolves outside the matched set", () => {
        const baseline = resolved(
            { path: "size.step.0", value: 16 },
            { path: "size.step.1", value: 18 },
            { path: "text.base", value: "{size.step.0}" },
        );
        const pathIndex = new PathIndex(baseline);

        const options = resolveOptions("text.*", pathIndex, baseline);

        expect(options.map((o) => o.key)).toEqual(["text.base"]);
    });
});
