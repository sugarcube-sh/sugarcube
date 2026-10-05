import { type Described, accepted, forms, literal, refusedAs, tuple } from "./shape.js";

const y = literal((raw) =>
    typeof raw === "number" && Number.isFinite(raw)
        ? accepted(raw)
        : refusedAs({ reason: "not-a-number", value: raw }),
);

function x(coordinate: "x1" | "x2") {
    return literal((raw) => {
        if (typeof raw !== "number" || !Number.isFinite(raw)) {
            return refusedAs({ reason: "not-a-number", value: raw });
        }
        return raw < 0 || raw > 1
            ? refusedAs({ reason: "x-out-of-range", value: raw, coordinate })
            : accepted(raw);
    });
}

export const cubicBezier = forms(
    {
        array: tuple([x("x1"), y, x("x2"), y], (raw) => ({
            reason: "not-four-numbers",
            count: raw.length,
        })),
    },
    (value) => ({ reason: "wrong-shape", value }),
) satisfies Described<"cubicBezier">;
