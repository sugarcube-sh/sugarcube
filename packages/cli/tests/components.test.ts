import { mkdir, mkdtemp, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "pathe";
import { x } from "tinyexec";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runComponents } from "../src/commands/components.js";
import { collectComponentOverwriteWarnings } from "../src/overwrite-warnings/collect-overwrite-warnings.js";

vi.mock("tinyexec", () => ({
    x: vi.fn(),
}));

const runPackageManager = vi.mocked(x);

const index = [
    {
        name: "card",
        type: "component",
        files: [
            { path: "components/card/react/card.tsx", type: "tsx", framework: "react" },
            { path: "components/card/card.css", type: "css", framework: "react" },
        ],
        dependencies: { react: ["dep-card"] },
        registryDependencies: { react: ["button"] },
    },
    {
        name: "button",
        type: "component",
        files: [
            { path: "components/button/react/button.tsx", type: "tsx", framework: "react" },
            { path: "components/button/button.css", type: "css", framework: "react" },
        ],
        dependencies: { react: ["dep-button"] },
    },
];

let fetched: string[] = [];

beforeEach(() => {
    fetched = [];
    runPackageManager.mockReset();
    runPackageManager.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
    vi.stubGlobal("fetch", async (url: string) => {
        fetched.push(new URL(url).pathname);
        if (url.endsWith("/index.json")) return Response.json(index);
        return Response.json({ content: `${url}\n` });
    });
    vi.spyOn(process.stdout, "write").mockReturnValue(true);
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe("sugarcube components", () => {
    it("installs a component and the components it needs, each once", async () => {
        const output = await mkdtemp(join(tmpdir(), "sugarcube-components-"));

        await runComponents(["card"], { framework: "react", force: true, silent: true, output });

        expect(runPackageManager).toHaveBeenCalledTimes(1);
        expect(runPackageManager.mock.calls[0]?.[1]).toEqual(["add", "dep-button", "dep-card"]);
        expect(fetched.filter((path) => path.includes("/components/button/"))).toEqual([
            "/r/components/button/react/button.tsx.json",
            "/r/components/button/button.css.json",
        ]);
        expect(await readdir(join(output, "button"))).toEqual(["button.css", "button.tsx"]);
        expect(await readdir(join(output, "card"))).toEqual(["card.css", "card.tsx"]);
    });

    it("warns about exactly the files it would write over", async () => {
        const output = await mkdtemp(join(tmpdir(), "sugarcube-components-"));
        await mkdir(join(output, "button"));
        await writeFile(join(output, "button", "button.css"), "");
        await writeFile(join(output, "button", "notes.md"), "");

        const warnings = collectComponentOverwriteWarnings({
            tree: index,
            framework: "react",
            componentsOutputDirectory: output,
        });

        expect(warnings.componentFiles.map((file) => file.split("/").slice(-2).join("/"))).toEqual([
            "button/button.css",
        ]);
    });
});
