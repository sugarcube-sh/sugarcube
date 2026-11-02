import { describe, expect, it, vi } from "vitest";
import { createSearch } from "../../src/controllers/search";
import { demoMessage, studioOn } from "./demo-message";

describe("createSearch", () => {
    it("finds nothing until something is typed", () => {
        const search = createSearch(studioOn(demoMessage()));

        expect(search.state.hits).toEqual([]);
        search.setQuery("   ");
        expect(search.state.hits).toEqual([]);
    });

    it("finds tokens whose path holds the query, ignoring case", () => {
        const search = createSearch(studioOn(demoMessage()));

        search.setQuery("onbrand");

        expect(search.state.query).toBe("onbrand");
        expect(search.state.hits.map((hit) => hit.path)).toEqual(["color.text.onBrand"]);
    });

    it("gives a colour a swatch of its literal value in the permutation shown", () => {
        const studio = studioOn(demoMessage());
        const search = createSearch(studio);
        search.setQuery("onbrand");
        const light = search.state.hits[0]?.swatch;

        studio.show({ mode: "dark" });

        const dark = search.state.hits[0]?.swatch;
        expect(dark).toBe(studio.state.value(studio.state.showing.getToken("color.brand.900")!));
        expect(dark).not.toBe(light);
        expect(dark).not.toContain("var(");
    });

    it("gives other tokens their value and no swatch", () => {
        const search = createSearch(studioOn(demoMessage()));

        search.setQuery("space.");

        const [hit] = search.state.hits;
        expect(hit?.swatch).toBeUndefined();
        expect(hit?.value).toMatch(/\d/);
    });

    it("gives a token the value the adapter writes, so a fluid size is its clamp()", () => {
        const search = createSearch(studioOn());

        search.setQuery("gutter");

        expect(search.state.hits[0]?.value).toBe("clamp(1rem, 0.6364rem + 1.8182vw, 2rem)");
    });

    it("stops at forty hits and says there are more", () => {
        const search = createSearch(studioOn(demoMessage()));

        search.setQuery(".");

        expect(search.state.hits).toHaveLength(40);
        expect(search.state.capped).toBe(true);
    });

    it("tells its listeners when the query or the tokens change, until destroyed", () => {
        const studio = studioOn(demoMessage());
        const search = createSearch(studio);
        const listener = vi.fn();
        search.subscribe(listener);

        search.setQuery("brand");
        studio.show({ mode: "dark" });
        search.destroy();
        studio.show({ mode: "light" });

        expect(listener).toHaveBeenCalledTimes(2);
    });
});
