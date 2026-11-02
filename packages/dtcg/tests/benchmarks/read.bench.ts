import { bench, describe } from "vitest";
import { readFromMemory } from "../../src/index.js";
import { extendsProject, permutationsProject, tokens } from "./fixtures.js";

const project = permutationsProject(100);
const entryFile = "tokens.resolver.json";
const oneFile = { "tokens.json": JSON.stringify(tokens(100)) };
const extending = extendsProject(120, 20);

describe("read, 300 tokens", () => {
    bench("24 combinations (4 × 3 × 2 contexts), every one", () => {
        readFromMemory({ files: project, entryFile });
    });

    bench("the same, each context on its own (7)", () => {
        readFromMemory({ files: project, entryFile }, { inputs: "each-context" });
    });

    bench("one token file, no resolver", () => {
        readFromMemory({ files: oneFile });
    });

    bench("120 groups extending one group of 20 tokens (2,400 inherited)", () => {
        readFromMemory({ files: extending });
    });
});
