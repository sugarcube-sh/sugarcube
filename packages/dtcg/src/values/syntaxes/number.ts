import { literal, err, ok } from "../syntax.js";

export const number = literal((raw) =>
    typeof raw === "number" && Number.isFinite(raw)
        ? ok(raw)
        : err({ reason: "not-a-number", value: raw }),
);
