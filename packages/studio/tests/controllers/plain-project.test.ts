import { describe, expect, it } from "vitest";
import { createSearch } from "../../src/controllers/search";
import { groupView } from "../../src/controllers/views";
import { plainMessage, studioOn, withFile } from "./demo-message";

describe("a plain DTCG project, with the plain adapter", () => {
    it("opens with no problems, showing the default permutation", () => {
        const studio = studioOn(plainMessage());

        expect(studio.state.problems).toEqual([]);
        expect(studio.state.showing.isDefault).toBe(true);
    });

    it("lists a group's tokens with the values the plain adapter writes", () => {
        const studio = studioOn(plainMessage());
        const fluid = studio.state.showing.getGroup("size.fluid");

        const gutter = fluid && groupView(fluid, studio.state.value).tokens[0];

        expect(gutter?.path).toBe("size.fluid.gutter");
        expect(gutter?.css).toBe("2rem");
    });

    it("finds tokens, each with the value the plain adapter writes", () => {
        const search = createSearch(studioOn(plainMessage()));

        search.setQuery("gutter");

        expect(search.state.hits[0]?.value).toBe("2rem");
    });

    it("writes the page's CSS with the plain adapter's settings", () => {
        expect(studioOn(plainMessage()).state.css).not.toContain("[data-mode");

        const studio = studioOn(
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
        const studio = studioOn(withFile("dark.json", '{ "color": { "text": ', plainMessage()));

        expect(studio.state.problems.map(({ kind }) => kind)).toContain("invalid-json");
    });

    it("takes in a changed file", () => {
        const studio = studioOn(plainMessage());
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

        const gutter = studio.state.showing.getToken("size.fluid.gutter");
        expect(gutter && studio.state.value(gutter)).toBe("3rem");
    });
});
