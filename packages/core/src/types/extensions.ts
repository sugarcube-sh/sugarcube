import type { DimensionValue } from "@sugarcube-sh/dtcg";

/**
 * Recipe for generating a family of dimension tokens from a single
 * group node. Authored under `$extensions["sh.sugarcube"].scale`;
 * sugarcube materializes the resulting tokens during the expand pass.
 */
export type ScaleExtension = ExponentialScaleConfig | MultiplierScaleConfig;

type BaseScaleConfig = {
    base: { min: DimensionValue; max: DimensionValue };
};

export type ExponentialScaleConfig = BaseScaleConfig & {
    mode: "exponential";
    ratio: { min: number; max: number };
    steps: { negative: number; positive: number };
};

export type MultiplierScaleConfig = BaseScaleConfig & {
    mode: "multipliers";
    multipliers: Record<string, number>;
    /**
     * Generate space pairs from named multipliers.
     * - omitted: no pairs
     * - "adjacent": one pair for each consecutive multiplier (sm-md, md-lg, …)
     * - string[]: explicit list like ["sm-lg", "xs-xl"]; each name must exist in `multipliers`
     */
    pairs?: "adjacent" | string[];
};
