import { describe, expect, it } from "vitest";
import { fieldName } from "../../src/controllers/forms";

describe("fieldName", () => {
    it("names a form's field after its row, its form and itself, as a value field is named", () => {
        expect(fieldName("base", "Fluid", "From")).toBe("base, Fluid, From");
    });

    it("leaves out the row for a form that has none, on a group or a recipe's step", () => {
        expect(fieldName(undefined, "Scale", "Ratio to")).toBe("Scale, Ratio to");
    });
});
