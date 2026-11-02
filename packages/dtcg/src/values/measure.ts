import { literal, no, object, ok, oneOf, wrongShape } from "./syntax.js";
import { number } from "./number.js";
import type { DimensionValue, DurationValue } from "../model.js";

/**
 * A number followed by a unit, such as `"16px"` or `"200ms"`: how earlier drafts of the spec wrote
 * dimensions and durations. It is always an error. Recognising one lets the error say so, and give
 * the object it stands for when its unit is one the type allows.
 */
const STRING_WITH_UNIT = /^(-?(?:\d+(?:\.\d*)?|\.\d+))([a-z%]+)$/i;

export function measure(units: readonly (DimensionValue["unit"] | DurationValue["unit"])[]) {
    const unit = literal((raw) => {
        const known = units.find((each) => each === raw);
        return known === undefined
            ? no({ reason: "unit-not-allowed", unit: raw, allowed: units })
            : ok(known);
    });
    return oneOf({
        object: object({ value: number, unit }),
        other: (raw) => {
            const found = typeof raw === "string" ? STRING_WITH_UNIT.exec(raw) : null;
            if (!found) return wrongShape(raw);
            const [value, digits, suffix] = found;
            const known = units.find((each) => each === suffix);
            return {
                reason: "string-with-unit",
                value,
                ...(known !== undefined && { asObject: { value: Number(digits), unit: known } }),
            };
        },
    });
}
