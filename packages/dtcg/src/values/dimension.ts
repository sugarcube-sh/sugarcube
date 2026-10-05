import { measure } from "./measure.js";
import type { Described } from "./shape.js";
import { dimensionUnits } from "./units.js";

export const dimension = measure(dimensionUnits) satisfies Described<"dimension">;
