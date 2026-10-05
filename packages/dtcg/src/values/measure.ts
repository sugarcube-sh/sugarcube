import { accepted, forms, literal, object, refusedAs } from "./shape.js";

/**
 * A number followed by a unit, such as `"16px"` or `"200ms"`: how earlier drafts of the spec wrote
 * dimensions and durations. It is always an error. Recognising one lets the error say so, and `read`
 * offer the object as a fix.
 */
export const STRING_WITH_UNIT = /^(-?(?:\d+(?:\.\d*)?|\.\d+))([a-z%]+)$/i;

const amount = literal((raw) =>
    typeof raw === "number" && Number.isFinite(raw)
        ? accepted(raw)
        : refusedAs({ reason: "not-a-number", value: raw }),
);

export function measure<U extends string>(units: readonly U[]) {
    const unit = literal<U>((raw) => {
        const known = units.find((each) => each === raw);
        return known === undefined
            ? refusedAs({ reason: "unit-not-allowed", unit: raw, allowed: units })
            : accepted(known);
    });
    return forms({ object: object({ value: { shape: amount }, unit: { shape: unit } }) }, (raw) =>
        typeof raw === "string" && STRING_WITH_UNIT.test(raw)
            ? { reason: "string-with-unit", value: raw }
            : { reason: "wrong-shape", value: raw },
    );
}
