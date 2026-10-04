import { join } from "node:path";
import { read } from "@sugarcube-sh/dtcg/node";
import { bench, describe } from "vitest";
import { fillDefaults } from "../../src/node/config/normalize.js";
import { emitCSS } from "../../src/shared/css/emit.js";
import { readOptions } from "../../src/shared/read-options.js";

const repo = join(import.meta.dirname, "../../../..");
const kits = join(repo, "apps/www/registry/tokens/starter-kits");

async function project(resolver: string) {
    const config = fillDefaults({ resolver, variables: { path: "variables.css" } });
    return { config, doc: await read(resolver, readOptions(config)) };
}

const projects = {
    "the static starter kit (463 tokens, 2 permutations)": await project(
        join(kits, "static/tokens.resolver.json"),
    ),
    "the fluid starter kit (489 tokens, 2 permutations)": await project(
        join(kits, "fluid/tokens.resolver.json"),
    ),
    "Studio's design tokens (210 tokens, 2 permutations)": await project(
        join(repo, "packages/studio/src/design-tokens/tokens.resolver.json"),
    ),
};

describe("emitCSS, on a Document already read", () => {
    for (const [name, { config, doc }] of Object.entries(projects)) {
        bench(name, () => {
            emitCSS(doc, config);
        });
    }
});
