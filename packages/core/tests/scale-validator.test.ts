import { describe, expect, it } from "vitest";
import { validateScaleExtension } from "../src/shared/validators/scale.js";
import type { TokenSource } from "../src/types/tokens.js";

const source: TokenSource = { sourcePath: "test.json" };
const path = "size.step.$extensions.sh.sugarcube.scale";

const validExponential = {
    mode: "exponential",
    viewport: { min: 320, max: 1440 },
    base: {
        min: { value: 1, unit: "rem" },
        max: { value: 1.125, unit: "rem" },
    },
    ratio: { min: 1.2, max: 1.25 },
    steps: { negative: 2, positive: 5 },
};

const validMultipliers = {
    mode: "multipliers",
    viewport: { min: 320, max: 1440 },
    base: {
        min: { value: 0.875, unit: "rem" },
        max: { value: 1, unit: "rem" },
    },
    multipliers: { sm: 1, md: 1.5, lg: 2 },
};

describe("validateScaleExtension - well-formed configs", () => {
    it("returns no errors for a valid exponential config", () => {
        expect(validateScaleExtension(validExponential, path, source)).toEqual([]);
    });

    it("returns no errors for a valid multipliers config (with pairs)", () => {
        expect(validateScaleExtension({ ...validMultipliers, pairs: true }, path, source)).toEqual(
            []
        );
    });

    it("returns no errors for a valid multipliers config (without pairs)", () => {
        expect(validateScaleExtension(validMultipliers, path, source)).toEqual([]);
    });
});

describe("validateScaleExtension - top-level shape", () => {
    it("rejects non-object input", () => {
        const errors = validateScaleExtension("nope", path, source);
        expect(errors).toHaveLength(1);
        expect(errors[0]?.path).toBe(path);
    });

    it("requires `mode`", () => {
        const { mode: _omit, ...rest } = validExponential;
        const errors = validateScaleExtension(rest, path, source);
        expect(errors.some((e) => e.path === `${path}.mode`)).toBe(true);
    });

    it("rejects unknown `mode` values", () => {
        const errors = validateScaleExtension(
            { ...validExponential, mode: "linear" },
            path,
            source
        );
        expect(errors.some((e) => e.path === `${path}.mode`)).toBe(true);
    });

    it("requires `viewport`", () => {
        const { viewport: _omit, ...rest } = validExponential;
        const errors = validateScaleExtension(rest, path, source);
        expect(errors.some((e) => e.path === `${path}.viewport`)).toBe(true);
    });

    it("requires `base`", () => {
        const { base: _omit, ...rest } = validExponential;
        const errors = validateScaleExtension(rest, path, source);
        expect(errors.some((e) => e.path === `${path}.base`)).toBe(true);
    });
});

describe("validateScaleExtension - viewport rules", () => {
    it("rejects viewport.min >= viewport.max", () => {
        const config = { ...validExponential, viewport: { min: 1440, max: 320 } };
        const errors = validateScaleExtension(config, path, source);
        expect(errors.some((e) => e.path === `${path}.viewport`)).toBe(true);
    });

    it("rejects viewport.min === viewport.max (not just less-than)", () => {
        const config = { ...validExponential, viewport: { min: 1000, max: 1000 } };
        const errors = validateScaleExtension(config, path, source);
        expect(errors.some((e) => e.path === `${path}.viewport`)).toBe(true);
    });

    it("rejects non-number viewport bounds", () => {
        const config = { ...validExponential, viewport: { min: "320px", max: 1440 } };
        const errors = validateScaleExtension(config, path, source);
        expect(errors.some((e) => e.path === `${path}.viewport.min`)).toBe(true);
    });
});

describe("validateScaleExtension - base rules", () => {
    it("rejects base.min with bad unit", () => {
        const config = {
            ...validExponential,
            base: {
                min: { value: 1, unit: "em" },
                max: { value: 1, unit: "rem" },
            },
        };
        const errors = validateScaleExtension(config, path, source);
        expect(errors.some((e) => e.path === `${path}.base.min.unit`)).toBe(true);
    });

    it("rejects non-numeric dimension value", () => {
        const config = {
            ...validExponential,
            base: {
                min: { value: "1rem", unit: "rem" },
                max: { value: 1, unit: "rem" },
            },
        };
        const errors = validateScaleExtension(config, path, source);
        expect(errors.some((e) => e.path === `${path}.base.min.value`)).toBe(true);
    });
});

describe("validateScaleExtension - exponential-only fields", () => {
    it("requires `ratio`", () => {
        const { ratio: _omit, ...rest } = validExponential;
        const errors = validateScaleExtension(rest, path, source);
        expect(errors.some((e) => e.path === `${path}.ratio`)).toBe(true);
    });

    it("requires `steps`", () => {
        const { steps: _omit, ...rest } = validExponential;
        const errors = validateScaleExtension(rest, path, source);
        expect(errors.some((e) => e.path === `${path}.steps`)).toBe(true);
    });

    it("rejects ratio <= 1", () => {
        const config = { ...validExponential, ratio: { min: 1, max: 1.25 } };
        const errors = validateScaleExtension(config, path, source);
        expect(errors.some((e) => e.path === `${path}.ratio.min`)).toBe(true);
    });

    it("rejects negative ratio", () => {
        const config = { ...validExponential, ratio: { min: 1.2, max: -1 } };
        const errors = validateScaleExtension(config, path, source);
        expect(errors.some((e) => e.path === `${path}.ratio.max`)).toBe(true);
    });

    it("rejects non-integer step counts", () => {
        const config = { ...validExponential, steps: { negative: 2, positive: 1.5 } };
        const errors = validateScaleExtension(config, path, source);
        expect(errors.some((e) => e.path === `${path}.steps.positive`)).toBe(true);
    });

    it("rejects negative step counts", () => {
        const config = { ...validExponential, steps: { negative: -1, positive: 5 } };
        const errors = validateScaleExtension(config, path, source);
        expect(errors.some((e) => e.path === `${path}.steps.negative`)).toBe(true);
    });
});

describe("validateScaleExtension - multipliers-only fields", () => {
    it("requires `multipliers`", () => {
        const { multipliers: _omit, ...rest } = validMultipliers;
        const errors = validateScaleExtension(rest, path, source);
        expect(errors.some((e) => e.path === `${path}.multipliers`)).toBe(true);
    });

    it("rejects empty multipliers object", () => {
        const config = { ...validMultipliers, multipliers: {} };
        const errors = validateScaleExtension(config, path, source);
        expect(errors.some((e) => e.path === `${path}.multipliers`)).toBe(true);
    });

    it("rejects non-numeric multiplier value", () => {
        const config = { ...validMultipliers, multipliers: { sm: 1, md: "1.5x" } };
        const errors = validateScaleExtension(config, path, source);
        expect(errors.some((e) => e.path === `${path}.multipliers.md`)).toBe(true);
    });

    it("rejects non-boolean `pairs`", () => {
        const config = { ...validMultipliers, pairs: "yes" };
        const errors = validateScaleExtension(config, path, source);
        expect(errors.some((e) => e.path === `${path}.pairs`)).toBe(true);
    });
});

describe("validateScaleExtension - reference rejection", () => {
    it("rejects a reference at the top level of viewport", () => {
        const config = { ...validExponential, viewport: "{viewport.default}" };
        const errors = validateScaleExtension(config, path, source);
        expect(errors.some((e) => e.path === `${path}.viewport`)).toBe(true);
    });

    it("rejects a reference inside a nested dimension value", () => {
        const config = {
            ...validExponential,
            base: {
                min: { value: "{size.base}", unit: "rem" },
                max: { value: 1.125, unit: "rem" },
            },
        };
        const errors = validateScaleExtension(config, path, source);
        expect(errors.some((e) => e.path === `${path}.base.min.value`)).toBe(true);
    });

    it("rejects a reference inside a multiplier value", () => {
        const config = {
            ...validMultipliers,
            multipliers: { sm: "{multiplier.small}", md: 1.5 },
        };
        const errors = validateScaleExtension(config, path, source);
        expect(errors.some((e) => e.path === `${path}.multipliers.sm`)).toBe(true);
    });

    it("does not flag string values that aren't references (e.g. mode)", () => {
        const errors = validateScaleExtension(validExponential, path, source);
        expect(errors).toEqual([]);
    });
});
