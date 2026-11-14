import { describe, expect, it } from "vitest";
import { createSearch } from "../../src/controllers/search";
import { getGroupView } from "../../src/controllers/views";
import { plainMessage, createDemoStudio, withFile } from "./demo-message";

describe("a plain DTCG project, with the plain adapter", () => {
    it("opens with no problems, showing the default permutation", () => {
        const studio = createDemoStudio(plainMessage());

        expect(studio.state.problems).toEqual([]);
        expect(studio.state.shownPermutation.isDefault).toBe(true);
    });

    it("lists a group's tokens with the values the plain adapter writes", () => {
        const studio = createDemoStudio(plainMessage());
        const fluid = studio.state.shownPermutation.getGroup("size.fluid");

        const gutter = fluid && getGroupView(fluid, studio.state.getValue).tokens[0];

        expect(gutter?.path).toBe("size.fluid.gutter");
        expect(gutter?.css).toBe("2rem");
    });

    it("finds tokens, each with the value the plain adapter writes", () => {
        const search = createSearch(createDemoStudio(plainMessage()));

        search.setQuery("gutter");

        expect(search.state.hits[0]?.value).toBe("2rem");
    });

    it("writes the page's CSS with the plain adapter's settings", () => {
        expect(createDemoStudio(plainMessage()).state.css).not.toContain("[data-mode");

        const studio = createDemoStudio(
            plainMessage({
                naming: { prefix: "ds" },
                blocks: [
                    { input: {}, selector: ":root" },
                    { input: { mode: "dark" }, selector: '[data-mode="dark"]' },
                ],
            }),
        );

        expect(studio.state.css).toContain('[data-mode="dark"] {');
        expect(studio.state.css).toContain("--ds-size-fluid-gutter: 2rem;");
    });

    it("lists what the read finds wrong in a file", () => {
        const studio = createDemoStudio(
            withFile("dark.json", '{ "color": { "text": ', plainMessage()),
        );

        expect(studio.state.problems.map(({ kind }) => kind)).toContain("invalid-json");
    });

    it("takes in a changed file", () => {
        const studio = createDemoStudio(plainMessage());
        const size = plainMessage().files["size.json"] ?? "";

        studio.receive(
            withFile(
                "size.json",
                size.replace(
                    '"$value": { "value": 2, "unit": "rem" }',
                    '"$value": { "value": 3, "unit": "rem" }',
                ),
                plainMessage(),
            ),
        );

        const gutter = studio.state.shownPermutation.getToken("size.fluid.gutter");
        expect(gutter && studio.state.getValue(gutter)).toBe("3rem");
    });
});
