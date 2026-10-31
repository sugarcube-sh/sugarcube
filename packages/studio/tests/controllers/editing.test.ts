import { create, remove, rename, setValue } from "@sugarcube-sh/dtcg-edit";
import { describe, expect, it, vi } from "vitest";
import { plainMessage, studioOn } from "./demo-message";

const darkText = { input: { mode: "dark" } } as const;

describe("editing in studio", () => {
    it("commits an operation's result, so the tokens, the page's CSS and the changes move on", () => {
        const studio = studioOn();
        const listener = vi.fn();
        studio.subscribe(listener);

        const done = studio.do(
            setValue(studio.state.tokens, "color.text.default", "{color.neutral.100}", darkText),
        );

        expect(done.tokens).toBe(studio.state.tokens);
        expect(
            studio.state.tokens.permutation({ mode: "dark" }).token("color.text.default")?.value,
        ).toEqual({ syntax: "curly-brace", path: "color.neutral.100" });
        expect(studio.state.css).toContain("--color-text-default: var(--color-neutral-100);");
        expect(studio.state.changes.map(({ kind, path }) => [kind, path])).toEqual([
            ["changed", "color.text.default"],
        ]);
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it("keeps the theme shown through an edit", () => {
        const studio = studioOn();
        studio.show({ mode: "dark" });

        studio.do(setValue(studio.state.tokens, "color.text.default", "{color.neutral.100}"));

        expect(studio.state.showing.label).toBe("mode: dark");
    });

    it("changes nothing for a refused operation, and says why", () => {
        const studio = studioOn();
        const before = studio.state;
        const listener = vi.fn();
        studio.subscribe(listener);

        const done = studio.do(rename(studio.state.tokens, "color.text.default", "muted"));

        expect(done.refused?.kind).toBe("taken");
        expect(studio.state).toBe(before);
        expect(listener).not.toHaveBeenCalled();
    });

    it("lists a rename as dtcg's diff gives it, once for each value the token has", () => {
        const studio = studioOn();

        studio.do(rename(studio.state.tokens, "color.text.default", "body"));

        expect(
            studio.state.changes.map(({ kind, path, permutations }) => [
                kind,
                path,
                permutations.label,
            ]),
        ).toEqual([
            ["renamed", "color.text.body", "mode: light"],
            ["renamed", "color.text.body", "mode: dark"],
        ]);
    });

    it("goes back to the files as opened when the edits are discarded", () => {
        const studio = studioOn();
        const opened = studio.state.tokens;
        studio.do(remove(studio.state.tokens, "color.text.muted"));

        studio.discard();

        expect(studio.state.tokens).toBe(opened);
        expect(studio.state.changes).toEqual([]);
    });

    it("edits a plain DTCG project with the plain adapter", () => {
        const studio = studioOn(plainMessage());

        studio.do(setValue(studio.state.tokens, "size.fluid.gutter", { value: 3, unit: "rem" }));

        const gutter = studio.state.showing.token("size.fluid.gutter");
        expect(gutter && studio.state.value(gutter)).toBe("3rem");
        expect(studio.state.changes).toHaveLength(1);
    });

    it("follows a token through a rename by its id", () => {
        const studio = studioOn();
        const id = studio.idOf("color.text.default");

        studio.do(rename(studio.state.tokens, "color.text.default", "body"));

        expect(id && studio.pathOf(id)).toBe("color.text.body");
    });

    it("forgets a removed token's id", () => {
        const studio = studioOn();
        const id = studio.idOf("color.text.muted");

        studio.do(remove(studio.state.tokens, "color.text.muted"));

        expect(id && studio.pathOf(id)).toBeUndefined();
    });

    it("creates a token, listed as added", () => {
        const studio = studioOn();

        studio.do(create(studio.state.tokens, "color.text.link", { $value: "{color.brand.500}" }));

        expect(studio.state.tokens.has("color.text.link")).toBe(true);
        expect(studio.state.changes.map(({ kind, path }) => [kind, path])).toEqual([
            ["added", "color.text.link"],
        ]);
    });
});
