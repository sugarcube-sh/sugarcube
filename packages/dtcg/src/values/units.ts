import type { DimensionValue, DurationValue } from "../model/value.js";

/**
 * The units a dimension can use, `"px"` and `"rem"`.
 *
 * @see {@link https://www.designtokens.org/TR/2025.10/format/#dimension | Format 8.2, Dimension}
 */
export const dimensionUnits: readonly DimensionValue["unit"][] = ["px", "rem"];

/**
 * The units a duration can use, `"ms"` and `"s"`.
 *
 * @see {@link https://www.designtokens.org/TR/2025.10/format/#duration | Format 8.5, Duration}
 */
export const durationUnits: readonly DurationValue["unit"][] = ["ms", "s"];
