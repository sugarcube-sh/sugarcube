import { measure } from "./measure.js";
import type { Described } from "./shape.js";
import { durationUnits } from "./units.js";

export const duration = measure(durationUnits) satisfies Described<"duration">;
