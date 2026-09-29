import type { DimensionValue, DurationValue } from "../index.js";

/** The units a dimension may use. */
export const dimensionUnits: readonly DimensionValue["unit"][] = ["px", "rem"];

/** The units a duration may use. */
export const durationUnits: readonly DurationValue["unit"][] = ["ms", "s"];
