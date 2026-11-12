import { literal, err, object, ok, oneOf, wrongShape } from "./syntax.js";
import { number } from "./number.js";
import type { DimensionValue, DurationValue } from "../model.js";

/**
 * A number followed by a unit, such as `"16px"`.
 *
 * Earlier drafts of the spec wrote dimensions this way. Recognising it lets the error explain.
 */
const STRING_WITH_UNIT = /^(-?(?:\d+(?:\.\d*)?|\.\d+))([a-z%]+)$/i;

export function measure(units: readonly (DimensionValue["unit"] | DurationValue["unit"])[]) {
    const unit = literal((raw) => {
        const known = units.find((each) => each === raw);
        return known === undefined
            ? err({ reason: "unit-not-allowed", unit: raw, allowed: units })
            : ok(known);
    });
    return oneOf({
        object: object({ value: number, unit }),
        other: (raw) => {
            const found = typeof raw === "string" ? STRING_WITH_UNIT.exec(raw) : null;
            if (!found) return wrongShape(raw);
            const [value, digits, suffix = ""] = found;
            const known = units.find((each) => each === suffix);
            return {
                reason: "string-with-unit",
                value,
                unit: suffix,
                allowed: units,
                ...(known !== undefined && { asObject: { value: Number(digits), unit: known } }),
            };
        },
    });
}
