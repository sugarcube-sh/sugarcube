import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CLI_PATH, PLAIN_OUTPUT, TEST_TIMEOUT, createPackageJson } from "./helpers.js";

interface Watching {
    output: () => string;
    until: (done: () => boolean, what: string) => Promise<void>;
}

const color = (hex: string) => ({ $type: "color", $value: hex });

describe("generate --watch", () => {
    let dir: string;
    let child: ChildProcess | undefined;

    beforeEach(async () => {
        dir = await mkdtemp(join(tmpdir(), "sugarcube-e2e-watch-"));
        await createPackageJson(dir);
        await mkdir(join(dir, "tokens"));
        await mkdir(join(dir, "src"));
        await tokens({ color: { ink: color("#111111") } });
        await resolver(["base.json"]);
        await config("");
        await writeFile(join(dir, "src/index.html"), `<p class="text-ink">hi</p>`);
    });

    afterEach(async () => {
        child?.kill();
        child = undefined;
        await rm(dir, { recursive: true, force: true });
    });

    const variables = () => join(dir, "out/tokens.css");
    const utilities = () => join(dir, "out/utilities.css");
    const text = (path: string) => (existsSync(path) ? readFileSync(path, "utf8") : "");

    function tokens(json: unknown, file = "base.json") {
        return writeFile(join(dir, "tokens", file), JSON.stringify(json, null, 2));
    }

    function resolver(files: string[]) {
        const sources = files.map((file) => ({ $ref: file }));
        return writeFile(
            join(dir, "tokens/tokens.resolver.json"),
            JSON.stringify({
                version: "2025.10",
                resolutionOrder: [{ type: "set", name: "base", sources }],
            }),
        );
    }

    function config(variablesExtra: string, utilitiesPath = "out/utilities.css") {
        return writeFile(
            join(dir, "sugarcube.config.ts"),
            `export default {
    resolver: "tokens/tokens.resolver.json",
    variables: { path: "out/tokens.css"${variablesExtra} },
    utilities: { path: "${utilitiesPath}", classes: { color: { source: "color.*", prefix: "text" } } },
    content: ["src/**/*.html"],
};
`,
        );
    }

    function watch(): Watching {
        let output = "";
        child = spawn("node", [CLI_PATH, "generate", "--watch"], {
            cwd: dir,
            env: { ...process.env, ...PLAIN_OUTPUT },
        });
        child.stdout?.on("data", (chunk) => {
            output += chunk;
        });
        child.stderr?.on("data", (chunk) => {
            output += chunk;
        });
        const until = async (done: () => boolean, what: string) => {
            const started = Date.now();
            while (!done()) {
                if (Date.now() - started > 10_000) {
                    throw new Error(`Waited for ${what}. Output:\n${output}`);
                }
                await new Promise((resolve) => setTimeout(resolve, 50));
            }
        };
        return { output: () => output, until };
    }

    async function ready(): Promise<Watching> {
        const watching = watch();
        await watching.until(() => watching.output().includes("Watching"), "the watcher");
        return watching;
    }

    it("rewrites the variables when a token is saved", { timeout: TEST_TIMEOUT }, async () => {
        const { until } = await ready();
        expect(text(variables())).toContain("#111111");

        await tokens({ color: { ink: color("#222222") } });

        await until(() => text(variables()).includes("#222222"), "the new value");
    });

    it("rewrites the utilities when markup is saved", { timeout: TEST_TIMEOUT }, async () => {
        await tokens({ color: { ink: color("#111111"), paper: color("#ffffff") } });
        const { until } = await ready();
        expect(text(utilities())).not.toContain("text-paper");

        await writeFile(join(dir, "src/index.html"), `<p class="text-ink text-paper">hi</p>`);

        await until(() => text(utilities()).includes("text-paper"), "the new class");
    });

    it(
        "keeps the last CSS when a saved file is broken, lists the problem, and writes again once fixed",
        { timeout: TEST_TIMEOUT },
        async () => {
            const { output, until } = await ready();
            const before = text(variables());

            await tokens({ color: { ink: color("#111111"), text: { $value: "{color.inc}" } } });
            await until(() => output().includes("No CSS was written."), "the problem");

            expect(output()).toContain(
                "tokens/base.json:8:17  error  `color.inc` does not exist; did you mean `color.ink`?",
            );
            expect(text(variables())).toBe(before);

            await tokens({ color: { ink: color("#333333") } });
            await until(() => text(variables()).includes("#333333"), "the fixed CSS");
        },
    );

    it(
        "starts with a broken file, and writes the CSS once it is fixed",
        { timeout: TEST_TIMEOUT },
        async () => {
            await writeFile(join(dir, "tokens/base.json"), `{ "color": { "ink": `);
            const { output, until } = await ready();

            expect(output()).toContain("No CSS was written.");
            expect(existsSync(variables())).toBe(false);

            await tokens({ color: { ink: color("#444444") } });
            await until(() => text(variables()).includes("#444444"), "the CSS");
        },
    );

    it("watches a file the resolver gains", { timeout: TEST_TIMEOUT }, async () => {
        const { until } = await ready();

        await tokens({ color: { paper: color("#555555") } }, "more.json");
        await resolver(["base.json", "more.json"]);
        await until(() => text(variables()).includes("#555555"), "the new file's token");

        await tokens({ color: { paper: color("#666666") } }, "more.json");
        await until(() => text(variables()).includes("#666666"), "the new file's change");
    });

    it(
        "watches a file the resolver names before it exists, and reads it once it does",
        { timeout: TEST_TIMEOUT },
        async () => {
            const { output, until } = await ready();

            await resolver(["base.json", "more.json"]);
            await until(() => output().includes("No CSS was written."), "the missing file");

            await tokens({ color: { paper: color("#888888") } }, "more.json");
            await until(() => text(variables()).includes("#888888"), "the new file read");
        },
    );

    it("reads the config again when it is saved", { timeout: TEST_TIMEOUT }, async () => {
        const { until } = await ready();

        await config(`, prefix: "ds"`);

        await until(() => text(variables()).includes("--ds-color-ink"), "the new prefix");
    });

    it(
        "writes the utilities where a saved config now says, with the same classes",
        { timeout: TEST_TIMEOUT },
        async () => {
            const { until } = await ready();

            await config("", "out/classes.css");

            await until(
                () => text(join(dir, "out/classes.css")).includes("text-ink"),
                "the utilities at the new path",
            );
        },
    );

    it(
        "lists a config that cannot be loaded, and carries on with the last one",
        { timeout: TEST_TIMEOUT },
        async () => {
            const { output, until } = await ready();
            const before = text(variables());

            await writeFile(join(dir, "sugarcube.config.ts"), "export default { variables: ;");
            await until(() => output().includes("invalid-config"), "the config's problem");

            expect(output()).toMatch(/^sugarcube\.config\.ts {2}error {2}/m);
            expect(text(variables())).toBe(before);

            await tokens({ color: { ink: color("#777777") } });
            await until(
                () => text(variables()).includes("#777777"),
                "a build with the last config",
            );
        },
    );
});
