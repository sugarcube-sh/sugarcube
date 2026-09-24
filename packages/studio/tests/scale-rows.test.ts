import type { ScaleBinding, ScaleExtension } from "@sugarcube-sh/core/client";
import { describe, expect, it } from "vitest";
import { scaleRows } from "../src/rows/scale-rows";
import type { ResolveContext } from "../src/rows/types";
import { PathIndex } from "../src/tokens/path-index";
import type { TokenSnapshot } from "../src/tokens/types";
import { snapshot, tree } from "./fixtures";

const BINDING: ScaleBinding = {
    type: "scale",
    token: "size.step.*",
    base: "size.step.0",
} as ScaleBinding;

const makeScale = (override: Partial<ScaleExtension> = {}): ScaleExtension =>
    ({
        mode: "exponential",
        base: { min: { value: 1, unit: "rem" }, max: { value: 1, unit: "rem" } },
        ratio: { min: 1.2, max: 1.2 },
        steps: { negative: 0, positive: 2 },
        ...override,
    }) as ScaleExtension;

function ctxWith(scale: ScaleExtension | null): ResolveContext {
    const base: TokenSnapshot = scale
        ? snapshot({
              trees: [
                  tree("size.json", {
                      size: { step: { $extensions: { "sh.sugarcube": { scale } } } },
                  }),
              ],
          })
        : snapshot({ trees: [tree("size.json", { size: { step: {} } })] });

    return {
        baseline: base,
        pathIndex: new PathIndex(base.resolved),
        context: "default",
        colorScale: undefined,
        resolved: base.resolved,
    };
}

function formatOf(row: { controls: { props: Record<string, unknown> }[] }, value: number) {
    const format = row.controls[0]?.props.formatValue as ((n: number) => string) | undefined;
    return format?.(value);
}

describe("scaleRows", () => {
    it("produces ratio then base for an exponential scale", () => {
        const rows = scaleRows(BINDING, ctxWith(makeScale()));

        expect(rows.map((r) => r.label)).toEqual(["Ratio", "Base"]);
        expect(rows.map((r) => r.key)).toEqual(["size.step.*:ratio", "size.step.*:base"]);
        expect(rows.map((r) => r.controls[0]?.editor)).toEqual(["range", "range"]);
        expect(rows.map((r) => r.controls.length)).toEqual([2, 2]);
    });

    it("keeps the ratio slider's bounds and its toFixed(2) announcement", () => {
        const [ratio] = scaleRows(BINDING, ctxWith(makeScale()));

        expect(ratio?.controls[0]?.props).toMatchObject({ min: 1, max: 2, step: 0.01 });
        expect(formatOf(ratio!, 1.2345)).toBe("1.23");
    });

    it("gives base and ratio a slider each for min and max", () => {
        const rows = scaleRows(BINDING, ctxWith(makeScale()));

        for (const row of rows) {
            expect(row.controls).toHaveLength(2);
            expect(row.controls.map((c) => c.editor)).toEqual(["range", "range"]);
        }
    });

    it("gives a multipliers scale its base and every multiplier", () => {
        const rows = scaleRows(
            BINDING,
            ctxWith(makeScale({ mode: "multipliers", multipliers: { sm: 0.5, md: 1, lg: 2 } })),
        );

        expect(rows.map((r) => r.label)).toEqual(["Base", "sm", "md", "lg"]);
        expect(formatOf(rows[0]!, 1.5)).toBe("1.5rem");
        expect(formatOf(rows[1]!, 0.5)).toBe("\u00d70.5");
    });

    it("produces no rows when a direct scale has nothing captured", () => {
        const withoutBase = { ...BINDING, base: undefined } as ScaleBinding;
        expect(scaleRows(withoutBase, ctxWith(null))).toEqual([]);
    });

    it("gives every row a control count that cannot change under it", () => {
        for (const scale of [
            makeScale(),
            makeScale({ mode: "multipliers", multipliers: { sm: 0.5, md: 1 } }),
        ]) {
            for (const row of scaleRows(BINDING, ctxWith(scale))) {
                expect(row.controls.length).toBeGreaterThan(0);
                expect(row.controls.length).toBeLessThanOrEqual(2);
            }
        }
    });
});
