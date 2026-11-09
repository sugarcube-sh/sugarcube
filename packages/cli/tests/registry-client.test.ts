import { afterEach, describe, expect, it, vi } from "vitest";
import { getRegistryFiles, getRegistryIndex } from "../src/registry/client.js";

const item = {
    name: "button",
    type: "component",
    description: "A button",
    frameworks: ["react"],
    files: [
        { path: "components/button/react", type: "tsx", framework: "react" },
        { path: "components/button/css", type: "css" },
    ],
    tokens: { "button.background": { type: "color", mapping: "color.brand" } },
    dependencies: { react: ["clsx"] },
    registryDependencies: { "css-only": ["base"] },
    tokenDependencies: ["color.brand"],
};

function answering(answers: Record<string, unknown>) {
    vi.stubGlobal("fetch", async (url: string) => {
        const key = Object.keys(answers).find((end) => url.endsWith(end));
        return key === undefined
            ? new Response(null, { status: 404 })
            : Response.json(answers[key]);
    });
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("the registry's index", () => {
    it("is taken as it is when every item is written as the CLI expects", async () => {
        answering({ "/index.json": [item, { name: "tokens", type: "tokens", files: [] }] });

        await expect(getRegistryIndex()).resolves.toEqual([
            item,
            { name: "tokens", type: "tokens", files: [] },
        ]);
    });

    it.for([
        ["not a list", { items: [item] }],
        ["an item with no files", [{ name: "button", type: "component" }]],
        ["an item named by a number", [{ ...item, name: 5 }]],
        ["a file with no path", [{ ...item, files: [{ type: "css" }] }]],
        [
            "a token mapping that isn't text",
            [{ ...item, tokens: { a: { type: "color", mapping: 1 } } }],
        ],
        ["dependencies for a framework there isn't", [{ ...item, dependencies: { vue: ["x"] } }]],
        ["a dependency that isn't text", [{ ...item, registryDependencies: { react: [1] } }]],
        ["token dependencies that aren't a list", [{ ...item, tokenDependencies: "color.brand" }]],
    ] as const)("is refused when it has %s", async ([, index]) => {
        answering({ "/index.json": index });

        await expect(getRegistryIndex()).rejects.toThrow("Invalid registry data received");
    });
});

describe("a registry file", () => {
    it("gives its content", async () => {
        answering({
            "/index.json": [item],
            "/components/button/css.json": { content: ".button {}" },
            "/components/button/react.json": { content: "export {}" },
        });

        const { files } = await getRegistryFiles({ type: "component", name: "button" });

        expect(files.map(({ content }) => content)).toEqual(["export {}", ".button {}"]);
    });

    it("is refused when its content isn't text", async () => {
        answering({
            "/index.json": [item],
            "/components/button/css.json": { content: 5 },
            "/components/button/react.json": { content: "export {}" },
        });

        await expect(getRegistryFiles({ type: "component", name: "button" })).rejects.toThrow(
            "Invalid file content received",
        );
    });
});
