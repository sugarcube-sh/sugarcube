import { readdirSync } from "node:fs";
import { join } from "node:path";
import { fillDefaults, problemCount, problemLines } from "@sugarcube-sh/core";
import { expect, it } from "vitest";
import { build } from "../src/build.js";
import { whereOf } from "../src/problems.js";

const MISTAKES = join(__dirname, "__fixtures__/mistakes");

async function shown(name: string): Promise<string> {
    const folder = join(MISTAKES, name);
    const resolver = join(folder, "tokens.resolver.json");
    const config = fillDefaults({ resolver, variables: { path: join(folder, "unwritten.css") } });
    const built = await build({ config: { ...config, resolver } }, { markup: false });
    const where = { ...whereOf(built), cwd: folder };
    const lines = problemLines(built.diagnostics, where, { colors: false });
    return [...lines, problemCount(built.diagnostics)].join("\n");
}

it("shows what a person reads for each common mistake", async () => {
    const names = readdirSync(MISTAKES).sort();
    const sections = await Promise.all(
        names.map(async (name) => `## ${name}\n${await shown(name)}\n`),
    );
    await expect(sections.join("\n")).toMatchFileSnapshot(
        join(__dirname, "__golden__/mistakes.txt"),
    );
});
