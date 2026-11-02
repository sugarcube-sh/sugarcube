import { readFromMemory } from "@sugarcube-sh/dtcg";
import { describe, expect, it } from "vitest";
import { sugarcube } from "../../src/adapters/sugarcube";
import { ENTRY, asSent, demoFiles } from "../controllers/demo-message";

function readWith(files = demoFiles(), config = asSent()) {
    return readFromMemory({ files, entry: ENTRY }, sugarcube(config).read);
}

describe("sugarcube", () => {
    it("reads with sugarcube's rules, so a scale recipe makes its steps", () => {
        const tokens = readWith();

        expect(tokens.getTokenPaths().some((path) => path.startsWith("size.step."))).toBe(true);
    });

    it("reads with sugarcube's rules, so a fluid range it can't read is a problem", () => {
        const files = demoFiles();
        const broken = {
            ...files,
            "size.json": files["size.json"]!.replace(
                '"min": { "value": 1, "unit": "rem" },\n              "max": { "value": 2, "unit": "rem" }',
                '"min": "1rem",\n              "max": { "value": 2, "unit": "rem" }',
            ),
        };
        expect(broken["size.json"]).not.toBe(files["size.json"]);

        expect(readWith(broken).getDiagnostics("size.fluid.gutter")).not.toEqual([]);
    });

    it("writes a fluid token's value as the build does, as clamp()", () => {
        const tokens = readWith();
        const gutter = tokens.getPermutation().getToken("size.fluid.gutter");

        expect(gutter && sugarcube(asSent()).write(tokens).value(gutter)).toBe(
            "clamp(1rem, 0.6364rem + 1.8182vw, 2rem)",
        );
    });

    it("writes a reference as the value it reaches in the theme asked about", () => {
        const tokens = readWith();
        const text = tokens.getPermutation({ mode: "dark" }).getToken("color.text.default");

        expect(text && sugarcube(asSent()).write(tokens).value(text)).toBe(
            "oklch(0.986 0.002 258)",
        );
    });

    it("writes the page's CSS as the build does, every theme under the config's selectors", () => {
        const tokens = readWith();
        const { css } = sugarcube(asSent()).write(tokens);

        expect(css).toContain("--size-fluid-gutter: clamp(1rem, 0.6364rem + 1.8182vw, 2rem);");
        expect(css).toContain('[data-mode="dark"] {');
        expect(css).toContain("--color-text-default: var(--color-neutral-50);");
    });

    it("names variables with the config's naming", () => {
        const config = asSent({ resolver: ENTRY, variables: { prefix: "ds" } });
        const { css } = sugarcube(config).write(readWith(demoFiles(), config));

        expect(css).toContain("--ds-size-fluid-gutter: clamp(");
    });

    it("reports what a build finds, such as two tokens writing one variable", () => {
        const files = demoFiles();
        const clashing = {
            ...files,
            "color.json": files["color.json"]!.replace(
                '"text": {',
                '"text-default": { "$value": "#000000" },\n    "text": {',
            ),
        };
        const tokens = readWith(clashing);

        expect(
            sugarcube(asSent())
                .write(tokens)
                .problems.map(({ kind }) => kind),
        ).toContain("same-variable-name");
    });
});
