import { literal, no, ok } from "./syntax.js";

export const number = literal((raw) =>
    typeof raw === "number" && Number.isFinite(raw)
        ? ok(raw)
        : no({ reason: "not-a-number", value: raw }),
);
