import type { DimensionValue } from "@sugarcube-sh/dtcg";

/**
 * A recipe that makes a scale of dimension tokens in a group.
 *
 * It is written in the group's `$extensions["sh.sugarcube"].scale`.
 *
 * @see {@link https://sugarcube.sh/docs/fluid-space-and-type/#scale-recipes | Scale recipes}
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
     * Pairs of steps to make tokens for, such as `sm-lg`.
     *
     * - `"adjacent"` makes a pair for each step and the next, such as `sm-md` and `md-lg`.
     * - An array makes the pairs named, such as `["sm-lg"]`. Each name is in `multipliers`.
     * - Left out, it makes no pairs.
     *
     * @see {@link https://sugarcube.sh/docs/fluid-space-and-type/#pair-tokens | Pair tokens}
     */
    pairs?: "adjacent" | string[];
};
