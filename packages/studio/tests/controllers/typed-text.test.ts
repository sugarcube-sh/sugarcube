import { describe, expect, it } from "vitest";
import { parseJSON } from "../../src/controllers/typed-text";

describe("parseJSON", () => {
    it("gives the value when the text is JSON", () => {
        expect(parseJSON('"{color.neutral.100}"')).toEqual({ value: "{color.neutral.100}" });
        expect(parseJSON('{ "value": 2, "unit": "rem" }')).toEqual({
            value: { value: 2, unit: "rem" },
        });
    });

    it("gives nothing when the text isn't JSON yet", () => {
        expect(parseJSON("{color.neutral.100}")).toBeUndefined();
        expect(parseJSON("")).toBeUndefined();
    });
});
