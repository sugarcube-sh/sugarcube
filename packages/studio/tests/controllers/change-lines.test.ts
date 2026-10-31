import { rename, setValue } from "@sugarcube-sh/dtcg-edit";
import { describe, expect, it } from "vitest";
import { changeLines } from "../../src/controllers/views";
import { studioOn } from "./demo-message";

describe("changeLines", () => {
    it("gives a line for each change, naming the theme it is in", () => {
        const studio = studioOn();
        studio.do(
            setValue(studio.state.tokens, "color.text.default", "{color.neutral.100}", {
                input: { mode: "dark" },
            }),
        );

        expect(changeLines(studio.state.changes)).toEqual([
            { kind: "changed", path: "color.text.default", inPermutations: "mode: dark" },
        ]);
    });

    it("names no theme for a change in every theme", () => {
        const studio = studioOn();
        studio.do(setValue(studio.state.tokens, "radius.md", { value: 0.5, unit: "rem" }));

        expect(changeLines(studio.state.changes)).toEqual([{ kind: "changed", path: "radius.md" }]);
    });

    it("gives a rename once for each theme dtcg reports it in, with where it came from", () => {
        const studio = studioOn();
        studio.do(rename(studio.state.tokens, "color.text.default", "body"));

        expect(changeLines(studio.state.changes)).toEqual([
            {
                kind: "renamed",
                from: "color.text.default",
                path: "color.text.body",
                inPermutations: "mode: light",
            },
            {
                kind: "renamed",
                from: "color.text.default",
                path: "color.text.body",
                inPermutations: "mode: dark",
            },
        ]);
    });
});
