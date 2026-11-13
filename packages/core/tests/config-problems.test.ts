import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { loadInternalConfig } from "../src/node/config/load.js";
import { validateSugarcubeConfig } from "../src/shared/config.js";
import { number, object, oneOf, optional, string } from "../src/shared/checks.js";
import type { ColorFallbackStrategy, FluidViewport } from "../src/types/config.js";
import { ConfigError, toConfigDiagnostics } from "../src/shared/config-error.js";
import { issuesIn, mistakesIn } from "./config-mistakes.js";

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
    return { lines: toConfigDiagnostics(error).map(({ message }) => message), error };
}

const entry = (fields: string) =>
    `export default { utilities: { classes: { color: { ${fields} } } } };`;

it("says a config that will not load could not be loaded, with the cause", async () => {
    const { lines, error } = await problemsWith('throw new Error("boom");\nexport default {};');

    expect(lines).toEqual(["could not be loaded: boom"]);
    expect(error.message).toBe("sugarcube.config.ts could not be loaded: boom");
});

it("says a config that throws something other than an error could not be loaded", async () => {
    const { lines } = await problemsWith('throw "boom";\nexport default {};');

    expect(lines).toEqual(["could not be loaded: boom"]);
});

it("names a setting of the wrong type, and what it must be", async () => {
    const { lines } = await problemsWith(entry('source: "color.*", prefix: 5'));

    expect(lines).toEqual(["`utilities.classes.color.prefix` must be a string, not a number"]);
});

it("names a setting that is missing, and where", async () => {
    const { lines } = await problemsWith(entry('prefix: "text"'));

    expect(lines).toEqual(["`utilities.classes.color` needs a `source`"]);
});

it("names a list item that is missing by its place, not as a property", async () => {
    const { lines } = await problemsWith(
        'export default { content: ["src/**/*.html", undefined] };',
    );

    expect(lines).toEqual(["`content.1` must be a string, not undefined"]);
});

it("lists the values a setting allows", async () => {
    const { lines } = await problemsWith(
        'export default { variables: { transforms: { colorFallbackStrategy: "fast" } } };',
    );

    expect(lines).toEqual([
        '`variables.transforms.colorFallbackStrategy` must be "native" or "polyfill", not "fast"',
    ]);
});

it("lists the naming cases there are, and says a delimiter is text", async () => {
    const { lines } = await problemsWith(
        'export default { variables: { case: "camel", delimiter: 5 } };',
    );

    expect(lines).toEqual([
        '`variables.case` must be "kebab", not "camel"',
        "`variables.delimiter` must be a string, not a number",
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

it("says the config itself is missing when there is none to check", () => {
    const missing = () => validateSugarcubeConfig(undefined);

    expect(missing).toThrow(ConfigError);
    expect(missing).toThrow("the config must be an object, not undefined");
});

it("lists the values a choice takes, and that a list of them is allowed too", async () => {
    const { lines } = await problemsWith(entry('source: "color.*", directions: 3'));

    expect(lines).toEqual([
        '`utilities.classes.color.directions` must be "top", "right", "bottom", "left", "x", "y", "full" or "all", or an array of them, not a number',
    ]);
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

    expect(toConfigDiagnostics(error)).toEqual([
        {
            kind: "invalid-config",
            severity: "error",
            message: "`variables.path` must be a string, not a number",
            docsUrl: "https://sugarcube.sh/errors/invalid-config",
            detail: {
                reason: "wrong-type",
                setting: "variables.path",
                expected: ["string"],
                received: "number",
            },
        },
    ]);
});

it.for([
    [{ varibles: { path: "x.css" } }, "`varibles` is not a setting"],
    [{ variables: { prefx: "ds" } }, "`variables.prefx` is not a setting"],
    [{ studio: { respository: "acme/site" } }, "`studio.respository` is not a setting"],
    [
        { variables: { transforms: { fluid: { min: 320, max: 1200, unit: "px" } } } },
        "`variables.transforms.fluid.unit` is not a setting",
    ],
    [
        { variables: { permutations: [{ input: {}, selector: ":root", media: "print" }] } },
        "`variables.permutations.0.media` is not a setting",
    ],
    [
        { utilities: { classes: { color: { source: "color.*", prefx: "text" } } } },
        "`utilities.classes.color.prefx` is not a setting",
    ],
] as const)("refuses a setting it doesn't know: %j", ([config, message]) => {
    expect(mistakesIn(config)).toEqual([message]);
});

it("names every unknown setting, after the mistakes in the ones it knows", () => {
    expect(mistakesIn({ varibles: {}, content: "src", utilites: {} })).toEqual([
        "`content` must be an array, not a string",
        "`varibles` is not a setting",
        "`utilites` is not a setting",
    ]);
});

it("takes any CSS property in utility classes and any modifier in an input", () => {
    expect(
        mistakesIn({
            utilities: {
                classes: { "--accent": { source: "color.brand" }, "gap": { source: "space.*" } },
            },
            variables: {
                permutations: [{ input: { mode: "dark", brand: "two" }, selector: ":root" }],
            },
        }),
    ).toEqual([]);
});

it("still takes the old name of redeclareDependents, so its rename can be pointed out", () => {
    expect(mistakesIn({ variables: { propagateDependents: true } })).toEqual([]);
});

it("ignores a setting that is undefined, as if it were left out", () => {
    expect(mistakesIn({ resolver: undefined, variables: { prefix: undefined } })).toEqual([]);
});

it("says a setting that must say something is empty", () => {
    expect(
        mistakesIn({
            variables: {
                permutations: [
                    { input: {}, selector: "" },
                    { input: {}, selector: [":root", ""] },
                ],
            },
            studio: { branch: "" },
        }),
    ).toEqual([
        "`variables.permutations.0.selector` is empty",
        "`variables.permutations.1.selector.1` is empty",
        "`studio.branch` is empty",
    ]);
});

it("says a list of selectors with nothing in it lists no selectors", () => {
    expect(mistakesIn({ variables: { permutations: [{ input: {}, selector: [] }] } })).toEqual([
        "`variables.permutations.0.selector` lists no selectors",
    ]);
});

it.for([
    [
        { repository: "acme" },
        '`studio.repository` is written as "owner/name", such as "acme/site", not "acme"',
    ],
    [
        { githubApp: "Acme Studio" },
        '`studio.githubApp` is the GitHub App\'s name as it appears in its address, such as "acme-studio" in github.com/apps/acme-studio, not "Acme Studio"',
    ],
    [
        { signInPath: "auth" },
        '`studio.signInPath` is a path on your site, such as "/api/sugarcube-studio", not "auth"',
    ],
] as const)("says how studio's %j is written, and what it was", ([studio, message]) => {
    expect(mistakesIn({ studio })).toEqual([message]);
});

it("says a source can have `*` only at the end, and what it was", () => {
    expect(
        mistakesIn({
            utilities: { classes: { margin: [{ source: "space.*" }, { source: "space*" }] } },
        }),
    ).toEqual([
        '`utilities.classes.margin.1.source` can have `*` only at the end, such as "color.*", not "space*"',
    ]);
});

it("says an empty source must name a group", () => {
    expect(mistakesIn({ utilities: { classes: { color: { source: "" } } } })).toEqual([
        '`utilities.classes.color.source` is empty: name the group its tokens come from, such as "color.*"',
    ]);
});

it("says variableName must be a function, like any setting of the wrong type", () => {
    expect(mistakesIn({ variables: { variableName: "kebab" } })).toEqual([
        "`variables.variableName` must be a function, not a string",
    ]);
});

it("lists a choice's values when the value is not even the right type", () => {
    expect(
        mistakesIn({ variables: { case: 5, transforms: { colorFallbackStrategy: 1 } } }),
    ).toEqual([
        '`variables.case` must be "kebab", not a number',
        '`variables.transforms.colorFallbackStrategy` must be "native" or "polyfill", not a number',
    ]);
});

it("says `an` before a setting that starts with a vowel", () => {
    expect(mistakesIn({ variables: { permutations: [{ selector: ":root" }] } })).toEqual([
        "`variables.permutations.0` needs an `input`",
    ]);
});

it("keeps an unknown setting as a fact", () => {
    expect(issuesIn({ varibles: {} })).toEqual([{ reason: "unknown", setting: "varibles" }]);
});

it("won't compile a check that disagrees with its setting's type", () => {
    // @ts-expect-error
    object<FluidViewport>({ min: string, max: number });
    // @ts-expect-error
    object<FluidViewport>({ min: number, max: optional(number) });
    // @ts-expect-error
    object<FluidViewport>({ min: number });
    // @ts-expect-error
    oneOf<ColorFallbackStrategy>({ native: true });
    // @ts-expect-error
    oneOf<ColorFallbackStrategy>({ native: true, polyfill: true, fast: true });

    expect(object<FluidViewport>({ min: number, max: number })).toBeTypeOf("function");
});
