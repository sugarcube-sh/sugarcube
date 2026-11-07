import { readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

interface Manifest {
    manifests: { id: string; file: string }[];
}

interface SuiteManifest {
    tests: {
        id: string;
        type: "PositiveEvaluationTest" | "NegativeEvaluationTest";
        input: string;
    }[];
}

export interface SuiteCase {
    id: string;
    valid: boolean;
    file: string;
    text: string;
}

const suiteFolder = join(import.meta.dirname, "2025.10");

function readJson<T>(path: string): T {
    return JSON.parse(readFileSync(join(suiteFolder, path), "utf8")) as T;
}

export const suiteCases: SuiteCase[] = readJson<Manifest>("manifest.json").manifests.flatMap(
    (manifest) =>
        readJson<SuiteManifest>(manifest.file).tests.map((test) => {
            const input = join(dirname(manifest.file), test.input);
            const name = basename(test.input, ".json");
            return {
                id: test.id,
                valid: test.type === "PositiveEvaluationTest",
                file: manifest.id === "resolver" ? `${name}.resolver.json` : `${name}.json`,
                text: readFileSync(join(suiteFolder, input), "utf8"),
            };
        }),
);
