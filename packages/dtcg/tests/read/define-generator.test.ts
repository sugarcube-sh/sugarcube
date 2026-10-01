import { describe, expectTypeOf, it } from "vitest";
import { type Generator, defineGenerator } from "../../src/index.js";

const messages = {
    "ratio-not-above-one": ({ ratio }: { ratio: number }) => `a ratio of ${ratio} is too small`,
    "no-multipliers": () => "`multipliers` must name at least one step",
};

describe("defineGenerator", () => {
    it("accepts each reason in its messages, with the facts that message takes", () => {
        const generator = defineGenerator({
            extension: ["com.example", "scale"],
            messages,
            generate: () => ({
                ok: false,
                errors: [
                    { path: ["ratio"], reason: "ratio-not-above-one", data: { ratio: 1 } },
                    { path: ["multipliers"], reason: "no-multipliers" },
                ],
            }),
        });
        expectTypeOf(generator).toEqualTypeOf<Generator>();
    });

    it("refuses a reason its messages do not have", () => {
        defineGenerator({
            extension: ["com.example", "scale"],
            messages,
            // @ts-expect-error
            generate: () => ({ ok: false, errors: [{ path: [], reason: "ratio-too-small" }] }),
        });
    });

    it("refuses facts its message does not take", () => {
        defineGenerator({
            extension: ["com.example", "scale"],
            messages,
            generate: () => ({
                ok: false,
                errors: [
                    // @ts-expect-error
                    { path: [], reason: "ratio-not-above-one", data: { ratio: "1" } },
                ],
            }),
        });
    });

    it("refuses a reason when it has no messages", () => {
        defineGenerator({
            extension: ["com.example", "scale"],
            // @ts-expect-error
            generate: () => ({ ok: false, errors: [{ path: [], reason: "anything" }] }),
        });
    });
});
