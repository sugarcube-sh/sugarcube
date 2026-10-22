import { remove, setValue } from "@sugarcube-sh/dtcg-edit";
import { describe, expect, it } from "vitest";
import {
    madeBy,
    newToken,
    placeRows,
    tokenPage,
    valueEdit,
    valueView,
} from "../../src/controllers/token-page";
import { problemRows } from "../../src/controllers/views";
import { demoMessage, studioOn } from "./demo-message";

describe("placeRows", () => {
    it("labels each place by the theme whose file writes it, or the set it is shared through", () => {
        const { tokens } = studioOn().state;

        expect(
            placeRows(tokens, "color.text.default").map((row) => [row.label, row.value]),
        ).toEqual([
            ["base", "{color.neutral.900}"],
            ["mode: dark", "{color.neutral.50}"],
        ]);
    });

    it("gives no label where there is no resolver, so nothing to tell apart", () => {
        const { tokens } = studioOn({
            adapter: { name: "plain", settings: {}, problems: [] },
            entry: "tokens.json",
            files: {
                "tokens.json": JSON.stringify({
                    space: { $type: "dimension", s: { $value: { value: 4, unit: "px" } } },
                }),
            },
        }).state;

        expect(placeRows(tokens, "space.s").map((row) => [row.label, row.value])).toEqual([
            [undefined, { value: 4, unit: "px" }],
        ]);
    });

    it("lets an edit at a row change exactly that row's file", () => {
        const studio = studioOn();
        const [base] = placeRows(studio.state.tokens, "color.text.default");

        studio.do(
            setValue(studio.state.tokens, "color.text.default", "{color.neutral.800}", {
                at: base!.at,
            }),
        );

        expect(
            placeRows(studio.state.tokens, "color.text.default").map((row) => row.value),
        ).toEqual(["{color.neutral.800}", "{color.neutral.50}"]);
    });
});

describe("newToken", () => {
    it("leaves the type out when it is the group's, so the token takes it from the group", () => {
        const group = studioOn().state.tokens.permutation().group("color.text");

        expect(newToken({ type: "color", value: "{color.brand.500}" }, group)).toEqual({
            $value: "{color.brand.500}",
        });
    });

    it("writes the type when it isn't the group's", () => {
        const group = studioOn().state.tokens.permutation().group("color.text");

        expect(newToken({ type: "dimension", value: { value: 1, unit: "rem" } }, group)).toEqual({
            $type: "dimension",
            $value: { value: 1, unit: "rem" },
        });
    });

    it("writes the type for a token made at the top, with no group", () => {
        expect(newToken({ type: "number", value: 1 }, undefined)).toEqual({
            $type: "number",
            $value: 1,
        });
    });
});

describe("a token's own problems", () => {
    it("include a missing reference the token writes, so each token that uses it shows it", () => {
        const studio = studioOn();
        studio.do(remove(studio.state.tokens, "color.brand.500"));

        for (const path of ["color.border.brand", "border.focus"]) {
            expect(
                problemRows(studio.state.tokens.diagnosticsFor(path)).map(({ kind }) => kind),
            ).toEqual(["missing-reference"]);
        }
        expect(studio.state.tokens.diagnosticsFor("color.text.default")).toEqual([]);
    });
});

describe("valueView", () => {
    it("gives a row for each place the token is written", () => {
        const { tokens } = studioOn().state;

        expect(
            valueView(tokens, "color.text.default", []).rows.map((row) => [
                row.label,
                row.value,
                row.unwritten,
            ]),
        ).toEqual([
            ["base", "{color.neutral.900}", false],
            ["mode: dark", "{color.neutral.50}", false],
        ]);
    });

    it("starts an override from the value in force for that theme", () => {
        const { tokens } = studioOn().state;

        const [, override] = valueView(tokens, "typography.text.sm", ["mode: dark"]).rows;

        expect(override).toMatchObject({
            label: "mode: dark",
            value: "{size.step.-1}",
            unwritten: true,
            where: { input: { mode: "dark" } },
        });
    });

    it("keeps an override's row, last, once it is written, so typing carries on in it", () => {
        const studio = studioOn();
        const before = valueView(studio.state.tokens, "typography.text.sm", ["mode: dark"]).rows;

        studio.do(
            setValue(studio.state.tokens, "typography.text.sm", "{size.step.0}", {
                input: { mode: "dark" },
            }),
        );
        const after = valueView(studio.state.tokens, "typography.text.sm", ["mode: dark"]).rows;

        expect(after.map((row) => row.key)).toEqual(before.map((row) => row.key));
        expect(after.at(-1)).toMatchObject({
            label: "mode: dark",
            value: "{size.step.0}",
            unwritten: false,
            where: { at: { file: "dark.json" } },
        });
    });

    it("offers nothing for a theme that isn't being added", () => {
        const { tokens } = studioOn().state;

        expect(valueView(tokens, "typography.text.sm", ["theme: none"]).rows).toHaveLength(1);
    });
});

describe("valueView's offers", () => {
    it("offers an override for each theme that can have one and isn't being added", () => {
        const studio = studioOn();

        expect(valueView(studio.state.tokens, "typography.text.sm", []).offers).toEqual([
            "mode: dark",
        ]);
        expect(valueView(studio.state.tokens, "typography.text.sm", ["mode: dark"]).offers).toEqual(
            [],
        );

        studio.do(
            setValue(studio.state.tokens, "typography.text.sm", "{size.step.0}", {
                input: { mode: "dark" },
            }),
        );
        expect(valueView(studio.state.tokens, "typography.text.sm", []).offers).toEqual([]);
    });
});

describe("a recipe's step", () => {
    it("has no value rows, offers no override, and can't be renamed or removed", () => {
        const { tokens } = studioOn().state;

        expect(valueView(tokens, "size.step.-1", [])).toEqual({
            rows: [],
            offers: [],
            actions: false,
        });
    });

    it("is unlike a token a file writes, which can be renamed and removed", () => {
        const { tokens } = studioOn().state;

        expect(valueView(tokens, "size.fluid.gutter", []).actions).toBe(true);
    });

    it("says the group whose recipe makes it, by the name of that group's form", () => {
        const { state } = studioOn();
        const step = state.showing.token("size.step.-1");

        expect(step && madeBy(step, state.showing, state.formFor)).toEqual({
            kind: "recipe",
            from: "size.step",
            by: "scale",
        });
    });

    it("names no recipe when the adapter has no form for the group", () => {
        const { state } = studioOn();
        const step = state.showing.token("size.step.-1");

        expect(step && madeBy(step, state.showing, () => undefined)).toEqual({
            kind: "group",
            from: "size.step",
        });
    });

    it("says it is made at the top of its file when no group holds the recipe", () => {
        const { state } = studioOn(
            demoMessage({
                entry: "tokens.json",
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
        const md = state.showing.token("md");

        expect(md && madeBy(md, state.showing, state.formFor)).toEqual({ kind: "top-level" });
    });

    it("is nothing for a token a file writes", () => {
        const { state } = studioOn();
        const gutter = state.showing.token("size.fluid.gutter");

        expect(gutter && madeBy(gutter, state.showing, state.formFor)).toBeUndefined();
    });
});

describe("tokenPage", () => {
    it("holds everything a written token's page draws, each row with its own form", () => {
        const { state } = studioOn();
        const gutter = state.showing.token("size.fluid.gutter")!;
        const page = tokenPage(state, gutter, []);

        expect(page.row.css).toBe("clamp(1rem, 0.6364rem + 1.8182vw, 2rem)");
        expect(page.rows.map((row) => row.form?.label)).toEqual(["Fluid"]);
        expect(page.actions).toBe(true);
        expect(page.made).toBeUndefined();
        expect(page.form).toBeUndefined();
        expect(page.problems).toEqual([]);
        expect(page.description).toEqual({ text: "", editable: true });
        expect(page.deprecation).toEqual({ box: { checked: false, untick: null, message: "" } });
    });

    it("gives a step no rows, its recipe's line and its range's form, read only", () => {
        const { state } = studioOn();
        const page = tokenPage(state, state.showing.token("size.step.-1")!, []);

        expect(page.rows).toEqual([]);
        expect(page.actions).toBe(false);
        expect(page.made).toEqual({ kind: "recipe", from: "size.step", by: "scale" });
        expect(page.form?.label).toBe("Fluid");
        expect(page.form?.write).toBeUndefined();
        expect(page.description.editable).toBe(false);
        expect(page.deprecation.box).toBeUndefined();
    });

    it("offers no description or deprecation for a token only there through $extends", () => {
        const { state } = studioOn(
            demoMessage({
                entry: "tokens.json",
                files: {
                    "tokens.json": JSON.stringify({
                        button: { $type: "number", pad: { $value: 4 } },
                        primary: { $extends: "{button}" },
                    }),
                },
            }),
        );
        const page = tokenPage(state, state.showing.token("primary.pad")!, []);

        expect(page.description.editable).toBe(false);
        expect(page.deprecation.box).toBeUndefined();
    });

    it("gives an override row no form until it is written", () => {
        const { state } = studioOn();
        const page = tokenPage(state, state.showing.token("size.fluid.gutter")!, ["mode: dark"]);
        const adding = page.rows.find((row) => row.unwritten);

        expect(adding).toBeDefined();
        expect(adding?.form).toBeUndefined();
    });
});

describe("valueEdit", () => {
    const { state } = studioOn();
    const [base, dark] = tokenPage(state, state.showing.token("color.text.default")!, []).rows;

    it("writes the value at the row's place", () => {
        const edit = valueEdit(state.tokens, "color.text.default", base!, "{color.neutral.800}");

        expect(edit.result.ops).toEqual([
            expect.objectContaining({
                kind: "set",
                file: base?.where.at?.file,
                value: "{color.neutral.800}",
            }),
        ]);
    });

    it("names one undo field for each row, each part and each control", () => {
        const name = (row = base!, part?: (string | number)[], control?: string) =>
            valueEdit(state.tokens, "color.text.default", row, "{color.neutral.800}", part, control)
                .options.merge;

        expect(name()).toBe(name());
        expect(name()).not.toBe(name(dark));
        expect(name(base, ["color"])).not.toBe(name(base, ["blur"]));
        expect(name(base, undefined, "space")).not.toBe(name(base, undefined, "channel 0"));
    });
});
