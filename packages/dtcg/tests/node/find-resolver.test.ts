import { describe, expect, it } from "vitest";
import { findResolver } from "../../src/node.js";
import { useTempFolder } from "./temp-folder.js";

const folder = useTempFolder("dtcg-find-");
const { at, files } = folder;

const one = (path: string) => ({ kind: "one", path: at(path) });
const several = (...paths: string[]) => ({ kind: "several", paths: paths.map(at) });

const resolver = JSON.stringify({ version: "2025.10", resolutionOrder: [] });
const tokens = JSON.stringify({ color: { $type: "color" } });

describe("findResolver, by name", () => {
    it("finds the one file named .resolver.json, however deep", async () => {
        await files({
            "src/tokens/tokens.resolver.json": resolver,
            "src/tokens/base.json": tokens,
        });
        expect(await findResolver(folder.path)).toStrictEqual(
            one("src/tokens/tokens.resolver.json"),
        );
    });

    it("gives several, in order, rather than choosing one", async () => {
        await files({ "b/b.resolver.json": resolver, "a/a.resolver.json": resolver });
        expect(await findResolver(folder.path)).toStrictEqual(
            several("a/a.resolver.json", "b/b.resolver.json"),
        );
    });

    it("finds none where a resolver has another name", async () => {
        await files({ "resolver.json": resolver, "package.json": '{ "version": "1.0.0" }' });
        expect(await findResolver(folder.path)).toStrictEqual({ kind: "none" });
    });

    it("skips dependency, build and hidden folders", async () => {
        await files({
            "node_modules/kit/kit.resolver.json": resolver,
            "dist/copy.resolver.json": resolver,
            ".git/x.resolver.json": resolver,
            ".storybook/stories.resolver.json": resolver,
            "build/copy.resolver.json": resolver,
            "tokens.resolver.json": resolver,
        });
        expect(await findResolver(folder.path)).toStrictEqual(one("tokens.resolver.json"));
    });

    it("checks a file it is given by its name", async () => {
        await files({ "tokens.resolver.json": resolver, "resolver.json": resolver });
        expect(await findResolver([at("resolver.json")])).toStrictEqual({ kind: "none" });
        expect(await findResolver([at("tokens.resolver.json")])).toStrictEqual(
            one("tokens.resolver.json"),
        );
    });

    it("searches folders and checks files given together", async () => {
        await files({ "a/a.resolver.json": resolver, "b.resolver.json": resolver });
        expect(await findResolver([at("a"), at("b.resolver.json")])).toStrictEqual(
            several("a/a.resolver.json", "b.resolver.json"),
        );
    });
    it("counts a file once when it is given and also inside a folder given", async () => {
        await files({ "tokens/tokens.resolver.json": resolver });
        expect(await findResolver([at("tokens"), at("tokens/tokens.resolver.json")])).toStrictEqual(
            one("tokens/tokens.resolver.json"),
        );
    });

    it("counts a file once when it is given spelled another way", async () => {
        await files({ "tokens/tokens.resolver.json": resolver });
        const spelled = `${folder.path}/tokens/./tokens.resolver.json`;
        expect(await findResolver([at("tokens"), spelled])).toStrictEqual(
            one("tokens/tokens.resolver.json"),
        );
    });
});

describe("findResolver, by content", () => {
    it("finds a resolver whatever its name, by its top-level resolutionOrder", async () => {
        await files({ "resolver.json": resolver, "base.json": tokens });
        expect(await findResolver(folder.path, { by: "content" })).toStrictEqual(
            one("resolver.json"),
        );
    });

    it("finds none in a file that only mentions resolutionOrder inside", async () => {
        await files({
            "package.json": '{ "version": "1.0.0" }',
            "notes.json": JSON.stringify({ example: { resolutionOrder: [] } }),
            "words.json": JSON.stringify({ text: '"resolutionOrder"' }),
        });
        expect(await findResolver(folder.path, { by: "content" })).toStrictEqual({ kind: "none" });
    });

    it("still finds a file named .resolver.json that lacks resolutionOrder, so its read says why", async () => {
        await files({ "broken.resolver.json": '{ "version": "2025.10" }' });
        expect(await findResolver(folder.path, { by: "content" })).toStrictEqual(
            one("broken.resolver.json"),
        );
    });

    it("gives several when one is named and another is not", async () => {
        await files({ "tokens.resolver.json": resolver, "example.json": resolver });
        expect(await findResolver(folder.path, { by: "content" })).toStrictEqual(
            several("example.json", "tokens.resolver.json"),
        );
    });

    it("checks a file it is given by what is inside it", async () => {
        await files({ "resolver.json": resolver });
        expect(await findResolver([at("resolver.json")], { by: "content" })).toStrictEqual(
            one("resolver.json"),
        );
    });
});
