import { describe, expect, it } from "vitest";
import { findTokenFiles } from "../../src/node.js";
import { useTempFolder } from "./temp-folder.js";

const folder = useTempFolder("dtcg-find-tokens-");
const { at, files } = folder;

const tokens = JSON.stringify({ space: { $type: "dimension", s: { $value: "4px" } } });
const packageJson = '{ "name": "site", "type": "module" }';

describe("findTokenFiles", () => {
    it("finds the token files, in order, however deep", async () => {
        await files({ "tokens/space.json": tokens, "tokens/a/color.json": tokens });
        expect(await findTokenFiles(folder.path)).toStrictEqual({
            tokenFiles: [at("tokens/a/color.json"), at("tokens/space.json")],
            otherFiles: [],
        });
    });

    it("counts a file that uses any of the spec's own properties, with or without a $value", async () => {
        await files({
            "recipe.json": JSON.stringify({
                space: { $type: "dimension", $extensions: { "com.example": { steps: 4 } } },
            }),
            "groups.json": JSON.stringify({ color: { $type: "color" } }),
            "misspelt.json": JSON.stringify({ color: { $type: "color", ink: { $valeu: "#000" } } }),
            "described.json": JSON.stringify({ old: { $deprecated: true, $description: "gone" } }),
            "extended.json": JSON.stringify({ dark: { $extends: "{light}" } }),
        });
        expect((await findTokenFiles(folder.path)).tokenFiles).toStrictEqual([
            at("described.json"),
            at("extended.json"),
            at("groups.json"),
            at("misspelt.json"),
            at("recipe.json"),
        ]);
    });

    it("gives the JSON files that use none of them apart, such as a package.json or a JSON Schema", async () => {
        await files({
            "package.json": packageJson,
            "tsconfig.json": '{ "compilerOptions": {} }',
            "config.schema.json": JSON.stringify({
                $schema: "https://json-schema.org/draft/2020-12/schema",
                type: "object",
                description: "Settings",
                properties: { theme: { $ref: "#/$defs/theme" } },
            }),
            "tokens.json": tokens,
        });
        expect(await findTokenFiles(folder.path)).toStrictEqual({
            tokenFiles: [at("tokens.json")],
            otherFiles: [at("config.schema.json"), at("package.json"), at("tsconfig.json")],
        });
    });

    it("finds files ending .tokens, as the spec recommends", async () => {
        await files({ "brand.tokens": tokens, "space.tokens.json": tokens, "notes.txt": tokens });
        expect((await findTokenFiles(folder.path)).tokenFiles).toStrictEqual([
            at("brand.tokens"),
            at("space.tokens.json"),
        ]);
    });

    it("still finds a token file it can't parse, so its read says why", async () => {
        await files({ "cut-short.json": '{ "s": { "$value": "4px" ' });
        expect((await findTokenFiles(folder.path)).tokenFiles).toStrictEqual([
            at("cut-short.json"),
        ]);
    });

    it("skips dependency, build and hidden folders", async () => {
        await files({
            "node_modules/kit/tokens.json": tokens,
            "dist/tokens.json": tokens,
            "build/tokens.json": tokens,
            "out/tokens.json": tokens,
            ".cache/tokens.json": tokens,
            "tokens.json": tokens,
        });
        expect(await findTokenFiles(folder.path)).toStrictEqual({
            tokenFiles: [at("tokens.json")],
            otherFiles: [],
        });
    });

    it("checks a file it is given by what is inside it", async () => {
        await files({ "tokens.json": tokens, "package.json": packageJson });
        expect(await findTokenFiles([at("tokens.json"), at("package.json")])).toStrictEqual({
            tokenFiles: [at("tokens.json")],
            otherFiles: [at("package.json")],
        });
    });

    it("counts a file once when it is given and also inside a folder given", async () => {
        await files({ "tokens/space.json": tokens });
        const spelled = `${folder.path}/tokens/./space.json`;
        expect((await findTokenFiles([at("tokens"), spelled])).tokenFiles).toStrictEqual([
            at("tokens/space.json"),
        ]);
    });

    it("throws for a path that doesn't exist", async () => {
        await expect(findTokenFiles(at("missing"))).rejects.toThrow();
    });
});
