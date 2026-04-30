import type { Dimension } from "./dtcg.js";

/**
 * Viewport bounds in CSS pixels, used to anchor fluid clamp() math.
 * Required on scale extensions (so scales are portable); optional on
 * a manually-authored `FluidExtension` (falls back to `transforms.fluid`
 * in the global config).
 */
export type ViewportConfig = {
    min: number;
    max: number;
};

/**
 * Fluid extension configuration for dimension tokens.
 * Enables responsive scaling between viewport sizes.
 *
 * `viewport` takes precedence over the global `transforms.fluid` config
 * when present. Scale-generated tokens always populate it; manually
 * authored fluid tokens may omit it.
 */
export type FluidExtension = {
    min: Dimension;
    max: Dimension;
    viewport?: ViewportConfig;
};

/**
 * Recipe for generating a family of dimension tokens from a single
 * group node. Authored under `$extensions["sh.sugarcube"].scale`;
 * sugarcube materializes the resulting tokens during the expand pass.
 */
export type ScaleExtension = ExponentialScaleConfig | MultiplierScaleConfig;

type BaseScaleConfig = {
    viewport: ViewportConfig;
    base: { min: Dimension; max: Dimension };
};

export type ExponentialScaleConfig = BaseScaleConfig & {
    mode: "exponential";
    ratio: { min: number; max: number };
    steps: { negative: number; positive: number };
};

export type MultiplierScaleConfig = BaseScaleConfig & {
    mode: "multipliers";
    multipliers: Record<string, number>;
    pairs?: boolean;
};

/**
 * Sugarcube-specific extensions following DTCG $extensions spec.
 * Uses reverse domain notation per DTCG specification.
 */
export type SugarcubeExtensions = {
    "sh.sugarcube"?: {
        fluid?: FluidExtension;
        scale?: ScaleExtension;
    };
};
