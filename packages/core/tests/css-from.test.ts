import { readFromMemory } from "@sugarcube-sh/dtcg";
import { describe, expect, it } from "vitest";
import { fillDefaults } from "../src/node/config/normalize.js";
import { generateCSS } from "../src/shared/css-from.js";
import { declare } from "../src/shared/css/declare.js";
import { emitCSS } from "../src/shared/css/emit.js";
import { createReadOptions } from "../src/shared/read-options.js";
import { locateProblems } from "../src/shared/diagnostics.js";
import { createUtilityRules } from "../src/shared/utilities/rules.js";
import { getUtilityTokens } from "../src/shared/utilities/tokens.js";
import type { UtilityClassesConfig } from "../src/types/config.js";

const color = (value: string) => ({ $type: "color", $value: value });

const json = {
    color: { ink: color("#111111"), paper: color("#ffffff"), brand: color("{color.missing}") },
};

function project(classes: UtilityClassesConfig) {
    const config = fillDefaults({
        variables: {
            path: "variables.css",
            propagateDependents: true,
            transforms: { colorFallbackStrategy: "polyfill" },
        },
        utilities: { classes },
    });
    const tokens = readFromMemory(
        { files: { "tokens.json": JSON.stringify(json) } },
        createReadOptions(config),
    );
    return { tokens, config };
}

const classes = {
    color: { source: "color.*", prefix: "text", safelist: ["ink", "nope"] },
    margin: { source: "space.*", prefix: "m" },
};

describe("generateCSS", () => {
    it("gives the declarations it made, for a reader that needs which variable is which token", () => {
        const { tokens, config } = project(classes);

        const entriesAndProblems = ({ entries, diagnostics }: ReturnType<typeof declare>) => ({
            entries,
            diagnostics,
        });

        expect(entriesAndProblems(generateCSS(tokens, config).declared)).toStrictEqual(
            entriesAndProblems(declare(tokens, config)),
        );
        expect(
            entriesAndProblems(
                generateCSS(tokens, config, { variables: false, utilities: false }).declared,
            ),
        ).toStrictEqual(entriesAndProblems(declare(tokens, config)));
    });

    it("gives what declaring, the variables and the utility rules give in turn", () => {
        const { tokens, config } = project(classes);
        const declared = declare(tokens, config);
        const emitted = emitCSS(declared, config);
        const ruled = createUtilityRules(getUtilityTokens(declared), classes);

        const made = generateCSS(tokens, config);

        expect(made.variables).toStrictEqual(emitted.files);
        expect(made.utilities).toStrictEqual({
            rules: expect.any(Array),
            prefixes: ruled.prefixes,
            safelist: ruled.safelist,
            customProperties: ruled.customProperties,
        });
        expect(made.utilities?.rules.map(([pattern]) => pattern)).toStrictEqual(
            ruled.rules.map(([pattern]) => pattern),
        );
        expect(made.diagnostics).toStrictEqual([
            ...declared.diagnostics,
            ...emitted.diagnostics,
            ...locateProblems(tokens, ruled.tokenProblems),
            ...ruled.diagnostics,
        ]);
        expect(made.diagnostics.map(({ kind }) => kind)).toStrictEqual([
            "missing-reference",
            "option-deprecated",
            "option-renamed",
            "utility-without-classes",
            "safelist-without-token",
        ]);
    });

    it("writes each class's variable through its rules", () => {
        const { tokens, config } = project(classes);
        const rules = generateCSS(tokens, config).utilities?.rules ?? [];
        const written = rules.flatMap(([pattern, handler]) => {
            const match = "text-ink".match(pattern);
            return match ? [handler(match)] : [];
        });
        expect(written).toStrictEqual([{ color: "var(--color-ink)" }]);
    });

    it("leaves out the variables with variables: false", () => {
        const { tokens, config } = project(classes);
        const made = generateCSS(tokens, config, { variables: false });
        expect(made.variables).toStrictEqual([]);
        expect(made.utilities?.safelist).toStrictEqual(["text-ink"]);
        expect(made.diagnostics.map(({ kind }) => kind)).toStrictEqual([
            "missing-reference",
            "option-deprecated",
            "utility-without-classes",
            "safelist-without-token",
        ]);
    });

    it("leaves out the utilities and their problems with utilities: false", () => {
        const { tokens, config } = project(classes);
        const made = generateCSS(tokens, config, { utilities: false });
        expect(made.variables).toHaveLength(1);
        expect(made.utilities).toBeUndefined();
        expect(made.diagnostics.map(({ kind }) => kind)).toStrictEqual([
            "missing-reference",
            "option-deprecated",
            "option-renamed",
        ]);
    });

    it("gives no utilities and no utility problems when the config asks for no classes", () => {
        const { tokens, config } = project({});
        const made = generateCSS(tokens, config);
        expect(made.variables).toHaveLength(1);
        expect(made.utilities).toBeUndefined();
        expect(made.diagnostics.map(({ kind }) => kind)).toStrictEqual([
            "missing-reference",
            "option-deprecated",
            "option-renamed",
        ]);
    });
});
