import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { loadInternalConfig } from "../src/node/config/load.js";
import { ConfigError, configProblems } from "../src/shared/config-error.js";

let folder: string;

beforeEach(async () => {
    folder = await mkdtemp(join(tmpdir(), "sugarcube-config-problems-"));
    vi.spyOn(process, "cwd").mockReturnValue(folder);
    await writeFile(
        join(folder, "tokens.resolver.json"),
        JSON.stringify({ version: "2025.10", resolutionOrder: [] }),
    );
});

afterEach(async () => {
    vi.restoreAllMocks();
    await rm(folder, { recursive: true, force: true });
});

async function problemsWith(text: string): Promise<{ lines: string[]; error: ConfigError }> {
    await writeFile(join(folder, "sugarcube.config.ts"), text);
    const error = await loadInternalConfig().then(
        () => {
            throw new Error("the config loaded");
        },
        (thrown: unknown) => thrown,
    );
    if (!(error instanceof ConfigError)) throw error;
    return { lines: configProblems(error).map(({ message }) => message), error };
}

const entry = (fields: string) =>
    `export default { utilities: { classes: { color: { ${fields} } } } };`;

it("says a config that will not load could not be loaded, with the cause", async () => {
    const { lines, error } = await problemsWith('throw new Error("boom");\nexport default {};');

    expect(lines).toEqual(["could not be loaded: boom"]);
    expect(error.message).toBe("sugarcube.config.ts could not be loaded: boom");
});

it("names a setting of the wrong type, and what it must be", async () => {
    const { lines } = await problemsWith(entry('source: "color.*", prefix: 5'));

    expect(lines).toEqual(["`utilities.classes.color.prefix` must be a string, not a number"]);
});

it("names a setting that is missing, and where", async () => {
    const { lines } = await problemsWith(entry('prefix: "text"'));

    expect(lines).toEqual(["`utilities.classes.color` needs a `source`"]);
});

it("lists the values a setting allows", async () => {
    const { lines } = await problemsWith(
        'export default { variables: { transforms: { colorFallbackStrategy: "fast" } } };',
    );

    expect(lines).toEqual([
        '`variables.transforms.colorFallbackStrategy` must be "native" or "polyfill", not "fast"',
    ]);
});

it("lists every form a setting takes when the value is none of them", async () => {
    const { lines } = await problemsWith(entry('source: "color.*", safelist: 5'));

    expect(lines).toEqual([
        "`utilities.classes.color.safelist` must be a boolean or an array, not a number",
    ]);
});

it("says the config itself is the wrong thing when it is not an object", async () => {
    const { lines } = await problemsWith("export default 5;");

    expect(lines).toEqual(["the config must be an object, not a number"]);
});

it("gives each mistake its own problem", async () => {
    const { lines, error } = await problemsWith(
        "export default { variables: { path: 5, prefix: 7 } };",
    );

    expect(lines).toEqual([
        "`variables.path` must be a string, not a number",
        "`variables.prefix` must be a string, not a number",
    ]);
    expect(error.message).toBe(lines.join("\n"));
});

it("words a problem from the facts it carries", async () => {
    const { error } = await problemsWith("export default { variables: { path: 5 } };");

    expect(configProblems(error)).toEqual([
        {
            kind: "invalid-config",
            severity: "error",
            message: "`variables.path` must be a string, not a number",
            docs: "https://sugarcube.sh/errors/invalid-config",
            detail: {
                reason: "wrong-type",
                setting: "variables.path",
                expected: ["string"],
                received: "number",
            },
        },
    ]);
});
