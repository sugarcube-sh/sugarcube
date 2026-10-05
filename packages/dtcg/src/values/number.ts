import { type Described, literal, no, ok } from "./shape.js";

export const number = literal((raw) =>
    typeof raw === "number" && Number.isFinite(raw)
        ? ok(raw)
        : no({ reason: "not-a-number", value: raw }),
) satisfies Described<"number">;
