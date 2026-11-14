import { describe, expect, it } from "vitest";
import { getFieldLabel, createSettingEdit } from "../../src/controllers/forms";
import { createDemoStudio } from "./demo-message";

describe("getFieldLabel", () => {
    it("names a form's field after its row, its form and itself, as a value field is named", () => {
        expect(getFieldLabel("base", "Fluid", "From")).toBe("base, Fluid, From");
    });

    it("leaves out the row for a form that has none, on a group or a recipe's step", () => {
        expect(getFieldLabel(undefined, "Scale", "Ratio to")).toBe("Scale, Ratio to");
    });
});

describe("createSettingEdit", () => {
    const { state } = createDemoStudio();
    const form = state.getForm(state.shownPermutation.getGroup("size.step")!)!;
    const write = form.write!;
    const rem = { value: 1, unit: "rem" };
    const field = (key: string, row?: string) => ({
        path: "size.step",
        form: form.label,
        key,
        row,
    });

    it("is the form's own write of the setting", () => {
        expect(createSettingEdit(field("base.min"), write, rem).result.ops).toEqual(
            write("base.min", rem).ops,
        );
    });

    it("names one undo field for each setting, on each row", () => {
        const name = (key: string, row?: string) =>
            createSettingEdit(field(key, row), write, rem).options.mergeKey;

        expect(name("base.min")).toBe(name("base.min"));
        expect(name("base.min")).not.toBe(name("base.max"));
        expect(name("base.min", "base")).not.toBe(name("base.min", "mode: dark"));
    });
});
