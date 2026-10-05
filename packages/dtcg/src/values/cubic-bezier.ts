import { oneOf, literal, no, ok, refuse, tuple } from "./syntax.js";

const y = literal((raw) =>
    typeof raw === "number" && Number.isFinite(raw)
        ? ok(raw)
        : no({ reason: "not-a-number", value: raw }),
);

function x(coordinate: "x1" | "x2") {
    return literal((raw) => {
        if (typeof raw !== "number" || !Number.isFinite(raw)) {
            return no({ reason: "not-a-number", value: raw });
        }
        return raw < 0 || raw > 1
            ? no({ reason: "x-out-of-range", value: raw, coordinate })
            : ok(raw);
    });
}

export const cubicBezier = oneOf({
    array: tuple([x("x1"), y, x("x2"), y], (raw) => ({
        reason: "not-four-numbers",
        count: raw.length,
    })),
    other: refuse("wrong-shape"),
});
