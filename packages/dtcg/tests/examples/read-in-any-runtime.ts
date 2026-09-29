// Reading the same tokens in a browser, in Deno and in Node. Only the function that fetches a
// file's text changes.
import { read } from "@sugarcube-sh/dtcg";
import { readFile } from "node:fs/promises";

await read("tokens.resolver.json", { readText: (path) => fetch(path).then((r) => r.text()) });
await read("tokens.resolver.json", { readText: (path) => Deno.readTextFile(path) });
await read("tokens.resolver.json", { readText: (path) => readFile(path, "utf8") });
