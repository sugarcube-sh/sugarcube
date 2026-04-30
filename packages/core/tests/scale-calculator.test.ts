import { describe, expect, it } from "vitest";
import { calculateScale } from "../src/shared/scale/calculator.js";
import type { ExponentialScaleConfig, MultiplierScaleConfig } from "../src/types/extensions.js";

const remBase = (min: number, max: number) => ({
    min: { value: min, unit: "rem" as const },
    max: { value: max, unit: "rem" as const },
});

const viewport = { min: 320, max: 1440 };

describe("calculateScale - exponential mode", () => {
    it("generates negative + zero + positive steps for the configured count", () => {
        const config: ExponentialScaleConfig = {
            mode: "exponential",
            viewport,
            base: remBase(1, 1.125),
            ratio: { min: 1.2, max: 1.25 },
            steps: { negative: 2, positive: 5 },
        };

        const result = calculateScale(config);

        expect(result).toHaveLength(8);
        expect(result.map((step) => step.name)).toEqual(["-2", "-1", "0", "1", "2", "3", "4", "5"]);
    });

    it("computes step values as base × ratio^n with separate min/max ratios", () => {
        const config: ExponentialScaleConfig = {
            mode: "exponential",
            viewport,
            base: remBase(1, 1.125),
            ratio: { min: 1.2, max: 1.25 },
            steps: { negative: 1, positive: 2 },
        };

        const result = calculateScale(config);

        expect(result[0]).toEqual({
            name: "-1",
            min: { value: 0.8333, unit: "rem" },
            max: { value: 0.9, unit: "rem" },
        });
        expect(result[1]).toEqual({
            name: "0",
            min: { value: 1, unit: "rem" },
            max: { value: 1.125, unit: "rem" },
        });
        expect(result[2]).toEqual({
            name: "1",
            min: { value: 1.2, unit: "rem" },
            max: { value: 1.4063, unit: "rem" },
        });
        expect(result[3]).toEqual({
            name: "2",
            min: { value: 1.44, unit: "rem" },
            max: { value: 1.7578, unit: "rem" },
        });
    });

    it("returns flat values when min and max ratios both equal 1", () => {
        const config: ExponentialScaleConfig = {
            mode: "exponential",
            viewport,
            base: remBase(1, 1),
            ratio: { min: 1, max: 1 },
            steps: { negative: 2, positive: 2 },
        };

        const result = calculateScale(config);

        for (const step of result) {
            expect(step.min.value).toBe(1);
            expect(step.max.value).toBe(1);
        }
    });

    it("preserves the unit from the base config on every step", () => {
        const config: ExponentialScaleConfig = {
            mode: "exponential",
            viewport,
            base: {
                min: { value: 16, unit: "px" },
                max: { value: 18, unit: "px" },
            },
            ratio: { min: 1.2, max: 1.25 },
            steps: { negative: 1, positive: 1 },
        };

        const result = calculateScale(config);

        for (const step of result) {
            expect(step.min.unit).toBe("px");
            expect(step.max.unit).toBe("px");
        }
    });
});

describe("calculateScale - multipliers mode", () => {
    it("generates one step per named multiplier", () => {
        const config: MultiplierScaleConfig = {
            mode: "multipliers",
            viewport,
            base: remBase(0.875, 1),
            multipliers: { xs: 0.75, sm: 1, md: 1.5 },
        };

        const result = calculateScale(config);

        expect(result).toHaveLength(3);
        expect(result.map((step) => step.name)).toEqual(["xs", "sm", "md"]);
    });

    it("computes each step as base × multiplier", () => {
        const config: MultiplierScaleConfig = {
            mode: "multipliers",
            viewport,
            base: remBase(1, 2),
            multipliers: { sm: 1, md: 1.5, lg: 2 },
        };

        const result = calculateScale(config);

        expect(result).toEqual([
            { name: "sm", min: { value: 1, unit: "rem" }, max: { value: 2, unit: "rem" } },
            { name: "md", min: { value: 1.5, unit: "rem" }, max: { value: 3, unit: "rem" } },
            { name: "lg", min: { value: 2, unit: "rem" }, max: { value: 4, unit: "rem" } },
        ]);
    });

    it("appends pair steps after named steps when pairs: true", () => {
        const config: MultiplierScaleConfig = {
            mode: "multipliers",
            viewport,
            base: remBase(1, 2),
            multipliers: { sm: 1, md: 1.5, lg: 2 },
            pairs: true,
        };

        const result = calculateScale(config);

        expect(result).toHaveLength(5);
        expect(result.map((step) => step.name)).toEqual(["sm", "md", "lg", "sm-md", "md-lg"]);
    });

    it("uses from.min and to.max for each pair (asymmetric growth)", () => {
        const config: MultiplierScaleConfig = {
            mode: "multipliers",
            viewport,
            base: remBase(1, 2),
            multipliers: { sm: 1, lg: 2 },
            pairs: true,
        };

        const result = calculateScale(config);
        const pair = result.find((step) => step.name === "sm-lg");

        expect(pair).toEqual({
            name: "sm-lg",
            min: { value: 1, unit: "rem" }, // base.min × multipliers.sm
            max: { value: 4, unit: "rem" }, // base.max × multipliers.lg
        });
    });

    it("emits no pair steps when pairs is omitted or false", () => {
        const config: MultiplierScaleConfig = {
            mode: "multipliers",
            viewport,
            base: remBase(1, 2),
            multipliers: { sm: 1, md: 1.5, lg: 2 },
        };

        const result = calculateScale(config);

        expect(result).toHaveLength(3);
    });
});

describe("calculateScale - rounding", () => {
    it("rounds to 4 decimal places", () => {
        const config: ExponentialScaleConfig = {
            mode: "exponential",
            viewport,
            base: remBase(1, 1),
            ratio: { min: 1.333, max: 1.333 },
            steps: { negative: 0, positive: 3 },
        };

        const result = calculateScale(config);

        // 1.333 ** 3 = 2.368593037 → rounded to 2.3686
        expect(result[3]?.min.value).toBe(2.3686);
    });
});
