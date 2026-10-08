import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { declare, utilityTokens } from "@sugarcube-sh/core";
import { describe, expect, it } from "vitest";
import { build } from "../src/build.js";
import { CASES, GOLDEN_DIR, type GoldenCase, goldenConfig, withoutBanner } from "./golden-cases.js";
import {
    decidedUtilities,
    decidedVariables,
    explainUtilities,
    explainVariables,
} from "./golden-decisions.js";

const partialTypography = Array.from(
    { length: 3 },
    () => "error invalid-value missing-property typography.partial",
);

const problems: Record<string, string[]> = {
    "core/resolver/complex": ["warning unknown-property"],
    "every-value-form/native": [...partialTypography, "warning option-renamed"],
    "every-value-form/polyfill": ["warning option-deprecated"],
};

async function built(goldenCase: GoldenCase) {
    const dir = mkdtempSync(join(tmpdir(), "sugarcube-golden-build-"));
    try {
        const outDir = join(dir, "out");
        const loaded = goldenConfig(goldenCase, dir, outDir);
        const { doc, files, diagnostics } = await build(loaded);
        return {
            config: loaded.config,
            doc,
            diagnostics,
            files: files.map((file) => ({
                name: relative(outDir, file.path),
                css: withoutBanner(file.css),
            })),
        };
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

describe("golden CSS through the CLI's build on the new core", () => {
    it.for(CASES)("$name", async (goldenCase) => {
        const { name } = goldenCase;
        const { config, doc, diagnostics, files } = await built(goldenCase);

        const found = diagnostics.map(({ severity, kind, detail, path }) => {
            const reason = "reason" in detail ? ` ${String(detail.reason)}` : "";
            return `${severity} ${kind}${reason} ${path ?? ""}`.trimEnd();
        });
        expect(found).toStrictEqual(problems[name] ?? []);

        const golden = readdirSync(join(GOLDEN_DIR, name)).sort();
        expect(files.map((file) => file.name).sort()).toStrictEqual(golden);

        for (const { name: file, css } of files) {
            const expected = readFileSync(join(GOLDEN_DIR, name, file), "utf8");
            const explained =
                file === "utilities.css"
                    ? explainUtilities(name, css, expected, utilityTokens(declare(doc, config)))
                    : explainVariables(`${name}/${file}`, css, expected);
            if (!explained) {
                expect(css, file).toBe(expected);
                continue;
            }
            expect(css, `${file} differs because ${explained.because} but matches`).not.toBe(
                expected,
            );
            expect(explained.unexplained, file).toStrictEqual([]);
        }
    });

    it("lists as decided only files the golden set has", () => {
        const files = new Set(
            CASES.flatMap(({ name }) =>
                readdirSync(join(GOLDEN_DIR, name)).map((file) => `${name}/${file}`),
            ),
        );
        const listed = [
            ...Object.keys(decidedVariables),
            ...Object.keys(decidedUtilities).map((name) => `${name}/utilities.css`),
        ];
        expect(listed.filter((each) => !files.has(each))).toStrictEqual([]);
    });
});
