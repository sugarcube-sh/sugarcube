import { type Described, accepted, literal, refusedAs } from "./shape.js";

export const number = literal((raw) =>
    typeof raw === "number" && Number.isFinite(raw)
        ? accepted(raw)
        : refusedAs({ reason: "not-a-number", value: raw }),
) satisfies Described<"number">;
