import { remove, setValue } from "@sugarcube-sh/dtcg-edit";
import { describe, expect, it } from "vitest";
import {
    getGenerationSource,
    getDefinitionRows,
    getTokenPageView,
    createValueEdit,
    getValueView,
} from "../../src/controllers/token-page";
import { toProblemRows } from "../../src/controllers/views";
import { demoMessage, createDemoStudio } from "./demo-message";

describe("getDefinitionRows", () => {
    it("labels each place by the theme whose file writes it, or the set it is shared through", () => {
        const { tokens } = createDemoStudio().state;

        expect(
            getDefinitionRows(tokens, "color.text.default").map((row) => [row.label, row.value]),
        ).toEqual([
            ["base", "{color.neutral.900}"],
            ["mode: dark", "{color.neutral.50}"],
        ]);
    });

    it("gives no label where there is no resolver, so nothing to tell apart", () => {
        const { tokens } = createDemoStudio({
            adapter: { name: "plain", settings: {}, problems: [] },
            entryFile: "tokens.json",
            files: {
                "tokens.json": JSON.stringify({
                    space: { $type: "dimension", s: { $value: { value: 4, unit: "px" } } },
                }),
            },
        }).state;

        expect(getDefinitionRows(tokens, "space.s").map((row) => [row.label, row.value])).toEqual([
            [undefined, { value: 4, unit: "px" }],
        ]);
    });

    it("lets an edit at a row change exactly that row's file", () => {
        const studio = createDemoStudio();
        const [base] = getDefinitionRows(studio.state.tokens, "color.text.default");

        studio.do(
            setValue(studio.state.tokens, "color.text.default", "{color.neutral.800}", {
                at: base!.span,
            }),
        );

        expect(
            getDefinitionRows(studio.state.tokens, "color.text.default").map((row) => row.value),
        ).toEqual(["{color.neutral.800}", "{color.neutral.50}"]);
    });
});

describe("a token's own problems", () => {
    it("include a missing reference the token writes, so each token that uses it shows it", () => {
        const studio = createDemoStudio();
        studio.do(remove(studio.state.tokens, "color.brand.500"));

        for (const path of ["color.border.brand", "border.focus"]) {
            expect(
                toProblemRows(studio.state.tokens.getDiagnostics(path)).map(({ kind }) => kind),
            ).toEqual(["missing-reference"]);
        }
        expect(studio.state.tokens.getDiagnostics("color.text.default")).toEqual([]);
    });
});

describe("getValueView", () => {
    it("gives a row for each place the token is written", () => {
        const { tokens } = createDemoStudio().state;

        expect(
            getValueView(tokens, "color.text.default", []).rows.map((row) => [
                row.label,
                row.value,
                row.isNew,
            ]),
        ).toEqual([
            ["base", "{color.neutral.900}", false],
            ["mode: dark", "{color.neutral.50}", false],
        ]);
    });

    it("starts an override from the value in force for that theme", () => {
        const { tokens } = createDemoStudio().state;

        const [, override] = getValueView(tokens, "typography.text.sm", ["mode: dark"]).rows;

        expect(override).toMatchObject({
            label: "mode: dark",
            value: "{size.step.-1}",
            isNew: true,
            valueOptions: { input: { mode: "dark" } },
        });
    });

    it("keeps an override's row, last, once it is written, so typing carries on in it", () => {
        const studio = createDemoStudio();
        const before = getValueView(studio.state.tokens, "typography.text.sm", ["mode: dark"]).rows;

        studio.do(
            setValue(studio.state.tokens, "typography.text.sm", "{size.step.0}", {
                input: { mode: "dark" },
            }),
        );
        const after = getValueView(studio.state.tokens, "typography.text.sm", ["mode: dark"]).rows;

        expect(after.map((row) => row.key)).toEqual(before.map((row) => row.key));
        expect(after.at(-1)).toMatchObject({
            label: "mode: dark",
            value: "{size.step.0}",
            isNew: false,
            valueOptions: { at: { file: "dark.json" } },
        });
    });

    it("offers nothing for a theme that isn't being added", () => {
        const { tokens } = createDemoStudio().state;

        expect(getValueView(tokens, "typography.text.sm", ["theme: none"]).rows).toHaveLength(1);
    });
});

describe("getValueView's overridable contexts", () => {
    it("offers an override for each theme that can have one and isn't being added", () => {
        const studio = createDemoStudio();

        expect(
            getValueView(studio.state.tokens, "typography.text.sm", []).overridableContexts,
        ).toEqual(["mode: dark"]);
        expect(
            getValueView(studio.state.tokens, "typography.text.sm", ["mode: dark"])
                .overridableContexts,
        ).toEqual([]);

        studio.do(
            setValue(studio.state.tokens, "typography.text.sm", "{size.step.0}", {
                input: { mode: "dark" },
            }),
        );
        expect(
            getValueView(studio.state.tokens, "typography.text.sm", []).overridableContexts,
        ).toEqual([]);
    });
});

describe("a recipe's step", () => {
    it("has no value rows, offers no override, and can't be renamed or removed", () => {
        const { tokens } = createDemoStudio().state;

        expect(getValueView(tokens, "size.step.-1", [])).toEqual({
            rows: [],
            overridableContexts: [],
            editable: false,
        });
    });

    it("is unlike a token a file writes, which can be renamed and removed", () => {
        const { tokens } = createDemoStudio().state;

        expect(getValueView(tokens, "size.fluid.gutter", []).editable).toBe(true);
    });

    it("says the group whose recipe makes it, by the name of that group's form", () => {
        const { state } = createDemoStudio();
        const step = state.shownPermutation.getToken("size.step.-1");

        expect(step && getGenerationSource(step, state.shownPermutation, state.getForm)).toEqual({
            kind: "recipe",
            from: "size.step",
            by: "scale",
        });
    });

    it("names no recipe when the adapter has no form for the group", () => {
        const { state } = createDemoStudio();
        const step = state.shownPermutation.getToken("size.step.-1");

        expect(step && getGenerationSource(step, state.shownPermutation, () => undefined)).toEqual({
            kind: "group",
            from: "size.step",
        });
    });

    it("says it is made at the top of its file when no group holds the recipe", () => {
        const { state } = createDemoStudio(
            demoMessage({
                entryFile: "tokens.json",
                files: {
                    "tokens.json": JSON.stringify({
                        $extensions: {
                            "sh.sugarcube": {
                                scale: {
                                    mode: "multipliers",
                                    base: {
                                        min: { value: 1, unit: "rem" },
                                        max: { value: 1, unit: "rem" },
                                    },
                                    multipliers: { md: 1 },
                                },
                            },
                        },
                    }),
                },
            }),
        );
        const md = state.shownPermutation.getToken("md");

        expect(md && getGenerationSource(md, state.shownPermutation, state.getForm)).toEqual({
            kind: "top-level",
        });
    });

    it("is nothing for a token a file writes", () => {
        const { state } = createDemoStudio();
        const gutter = state.shownPermutation.getToken("size.fluid.gutter");

        expect(
            gutter && getGenerationSource(gutter, state.shownPermutation, state.getForm),
        ).toBeUndefined();
    });
});

describe("getTokenPageView", () => {
    it("holds everything a written token's page draws, each row with its own form", () => {
        const { state } = createDemoStudio();
        const gutter = state.shownPermutation.getToken("size.fluid.gutter")!;
        const page = getTokenPageView(state, gutter, []);

        expect(page.row.css).toBe("clamp(1rem, 0.6364rem + 1.8182vw, 2rem)");
        expect(page.rows.map((row) => row.form?.label)).toEqual(["Fluid"]);
        expect(page.editable).toBe(true);
        expect(page.generatedBy).toBeUndefined();
        expect(page.form).toBeUndefined();
        expect(page.problems).toEqual([]);
        expect(page.description).toEqual({ text: "", editable: true });
        expect(page.deprecation).toEqual({
            checkbox: { checked: false, uncheckedValue: null, message: "" },
        });
    });

    it("gives a step no rows, its recipe's line and its range's form, read only", () => {
        const { state } = createDemoStudio();
        const page = getTokenPageView(state, state.shownPermutation.getToken("size.step.-1")!, []);

        expect(page.rows).toEqual([]);
        expect(page.editable).toBe(false);
        expect(page.generatedBy).toEqual({ kind: "recipe", from: "size.step", by: "scale" });
        expect(page.form?.label).toBe("Fluid");
        expect(page.form?.write).toBeUndefined();
        expect(page.description.editable).toBe(false);
        expect(page.deprecation.checkbox).toBeUndefined();
    });

    it("offers no description or deprecation for a token only there through $extends", () => {
        const { state } = createDemoStudio(
            demoMessage({
                entryFile: "tokens.json",
                files: {
                    "tokens.json": JSON.stringify({
                        button: { $type: "number", pad: { $value: 4 } },
                        primary: { $extends: "{button}" },
                    }),
                },
            }),
        );
        const page = getTokenPageView(state, state.shownPermutation.getToken("primary.pad")!, []);

        expect(page.description.editable).toBe(false);
        expect(page.deprecation.checkbox).toBeUndefined();
    });

    it("gives an override row no form until it is written", () => {
        const { state } = createDemoStudio();
        const page = getTokenPageView(
            state,
            state.shownPermutation.getToken("size.fluid.gutter")!,
            ["mode: dark"],
        );
        const adding = page.rows.find((row) => row.isNew);

        expect(adding).toBeDefined();
        expect(adding?.form).toBeUndefined();
    });
});

describe("createValueEdit", () => {
    const { state } = createDemoStudio();
    const [base, dark] = getTokenPageView(
        state,
        state.shownPermutation.getToken("color.text.default")!,
        [],
    ).rows;

    it("writes the value at the row's place", () => {
        const edit = createValueEdit(
            state.tokens,
            "color.text.default",
            base!,
            "{color.neutral.800}",
        );

        expect(edit.result.ops).toEqual([
            expect.objectContaining({
                kind: "set",
                file: base?.valueOptions.at?.file,
                value: "{color.neutral.800}",
            }),
        ]);
    });

    it("names one undo field for each row, each part and each control", () => {
        const name = (row = base!, part?: (string | number)[], control?: string) =>
            createValueEdit(
                state.tokens,
                "color.text.default",
                row,
                "{color.neutral.800}",
                part,
                control,
            ).options.mergeKey;

        expect(name()).toBe(name());
        expect(name()).not.toBe(name(dark));
        expect(name(base, ["color"])).not.toBe(name(base, ["blur"]));
        expect(name(base, undefined, "space")).not.toBe(name(base, undefined, "channel 0"));
    });
});
