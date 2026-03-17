import type { Dimension } from "./dtcg.js";

/**
 * Fluid extension configuration for dimension tokens.
 * Enables responsive scaling between viewport sizes.
 */
export type FluidExtension = {
    min: Dimension;
    max: Dimension;
};

/**
 * Sugarcube-specific extensions following DTCG $extensions spec.
 * Uses reverse domain notation per DTCG specification.
 */
export type SugarcubeExtensions = {
    "sh.sugarcube"?: {
        fluid?: FluidExtension;
    };
};
