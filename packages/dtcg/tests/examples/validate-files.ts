// A validate command for token files with no resolver. The files are read together, in order, and
// every problem is printed.
import { readFromMemory } from "@sugarcube-sh/dtcg";
import { readFile } from "node:fs/promises";

declare const paths: string[];

const files = Object.fromEntries(
    await Promise.all(paths.map(async (p) => [p, await readFile(p, "utf8")] as const)),
);
const doc = readFromMemory({ files });
for (const d of doc.diagnostics) showMessage(`${d.severity}  ${d.at?.file ?? ""}  ${d.message}`);
