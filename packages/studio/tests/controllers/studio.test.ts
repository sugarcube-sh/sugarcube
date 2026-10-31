import { describe, expect, it, vi } from "vitest";
import {
    asSent,
    configProblem,
    demoMessage,
    studioOn,
    sugarcubeSent,
    withFile,
} from "./demo-message";

describe("createStudio", () => {
    it("opens the files the host sent, showing the default permutation", () => {
        const studio = studioOn(demoMessage());

        expect(studio.state.tokens.has("color.text.onBrand")).toBe(true);
        expect(studio.state.showing.label).toBe("mode: light");
        expect(studio.state.showing.isDefault).toBe(true);
        expect(studio.state.changes).toEqual([]);
    });

    it("shows another permutation when asked, and tells its listeners", () => {
        const studio = studioOn(demoMessage());
        const before = studio.state;
        const listener = vi.fn();
        studio.subscribe(listener);

        studio.show({ mode: "dark" });

        expect(studio.state.showing.label).toBe("mode: dark");
        expect(studio.state).not.toBe(before);
        expect(studio.state.tokens).toBe(before.tokens);
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it("writes the page's CSS from the tokens, outside any cascade layer", () => {
        const studio = studioOn(
            demoMessage({
                adapter: sugarcubeSent({
                    config: asSent({
                        resolver: "tokens.resolver.json",
                        variables: { layer: "tokens" },
                    }),
                }),
            }),
        );

        expect(studio.state.css).toContain("--color-text-onBrand:");
        expect(studio.state.css).not.toContain("@layer");
    });

    it("lists the host's problems first, then the ones a build finds", () => {
        const broken = withFile(
            "dark.json",
            '{ "color": { "text": ',
            demoMessage({ adapter: sugarcubeSent({ problems: [configProblem] }) }),
        );
        const studio = studioOn(broken);

        const kinds = studio.state.problems.map((problem) => problem.kind);
        expect(kinds[0]).toBe("invalid-config");
        expect(kinds).toContain("invalid-json");
    });

    it("has no problems for the demo as it is", () => {
        expect(studioOn(demoMessage()).state.problems).toEqual([]);
    });

    it("takes in a changed file, keeping the permutation shown and every token it didn't touch", () => {
        const studio = studioOn(demoMessage());
        studio.show({ mode: "dark" });
        const before = studio.state.tokens;
        const dark = demoMessage().files["dark.json"] ?? "";

        studio.receive(
            withFile("dark.json", dark.replace("{color.neutral.50}", "{color.neutral.100}")),
        );

        const after = studio.state.tokens;
        expect(after).not.toBe(before);
        expect(studio.state.showing.label).toBe("mode: dark");
        expect(studio.state.showing.token("color.text.default")?.value).toEqual({
            syntax: "curly-brace",
            path: "color.neutral.100",
        });
        expect(after.permutation({ mode: "dark" }).token("color.brand.500")).toBe(
            before.permutation({ mode: "dark" }).token("color.brand.500"),
        );
        expect(after.permutation().token("color.text.default")).toBe(
            before.permutation().token("color.text.default"),
        );
    });

    it("changes nothing when the host sends the same files again", () => {
        const studio = studioOn(demoMessage());
        const before = studio.state;
        const listener = vi.fn();
        studio.subscribe(listener);

        studio.receive(demoMessage());

        expect(studio.state).toBe(before);
        expect(listener).not.toHaveBeenCalled();
    });

    it("reads again with a changed config", () => {
        const studio = studioOn(demoMessage());

        studio.receive(
            demoMessage({
                adapter: sugarcubeSent({
                    config: asSent({
                        resolver: "tokens.resolver.json",
                        variables: { prefix: "ds" },
                    }),
                }),
            }),
        );

        expect(studio.state.css).toContain("--ds-color-text-onBrand:");
    });

    it("keeps the permutation shown when the resolver gains a modifier", () => {
        const studio = studioOn(demoMessage());
        studio.show({ mode: "dark" });
        const resolver = JSON.parse(demoMessage().files["tokens.resolver.json"] ?? "{}");
        resolver.resolutionOrder.push({
            type: "modifier",
            name: "density",
            default: "comfy",
            contexts: { comfy: [], compact: [] },
        });

        studio.receive(withFile("tokens.resolver.json", JSON.stringify(resolver)));

        expect(studio.state.showing.input).toStrictEqual({ mode: "dark", density: "comfy" });
    });

    it("shows the default when the permutation shown is no longer read", () => {
        const studio = studioOn(demoMessage());
        studio.show({ mode: "dark" });
        const resolver = JSON.parse(demoMessage().files["tokens.resolver.json"] ?? "{}");
        resolver.resolutionOrder[1].contexts = { light: [] };

        studio.receive(withFile("tokens.resolver.json", JSON.stringify(resolver)));

        expect(studio.state.showing.label).toBe("mode: light");
    });

    it("asks the adapter for a token's value, so a fluid size is the clamp() the page gets", () => {
        const studio = studioOn();
        const gutter = studio.state.showing.token("size.fluid.gutter");

        expect(gutter && studio.state.value(gutter)).toBe(
            "clamp(1rem, 0.6364rem + 1.8182vw, 2rem)",
        );
        expect(studio.state.css).toContain(
            "--size-fluid-gutter: clamp(1rem, 0.6364rem + 1.8182vw, 2rem);",
        );
    });

    it("reads again with the adapter the host sends next", () => {
        const studio = studioOn();

        studio.receive(demoMessage({ adapter: { name: "plain", settings: {}, problems: [] } }));

        const gutter = studio.state.showing.token("size.fluid.gutter");
        expect(gutter && studio.state.value(gutter)).toBe("2rem");
        expect(studio.state.css).not.toContain("[data-mode");
    });

    it("stops telling listeners once destroyed", () => {
        const studio = studioOn(demoMessage());
        const listener = vi.fn();
        studio.subscribe(listener);

        studio.destroy();
        studio.show({ mode: "dark" });

        expect(listener).not.toHaveBeenCalled();
    });
});
