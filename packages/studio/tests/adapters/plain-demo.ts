import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const PLAIN_DEMO = join(__dirname, "../../../dtcg-edit/tests/fixtures/demo");

export const PLAIN_ENTRY = "tokens.resolver.json";

export function readPlainFiles(): Record<string, string> {
    return Object.fromEntries(
        readdirSync(PLAIN_DEMO)
            .filter((name) => name.endsWith(".json"))
            .map((name) => [name, readFileSync(join(PLAIN_DEMO, name), "utf8")]),
    );
}
