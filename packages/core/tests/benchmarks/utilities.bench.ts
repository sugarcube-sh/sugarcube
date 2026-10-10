import { ok } from "node:assert";
import { join } from "node:path";
import { read } from "@sugarcube-sh/dtcg/node";
import { bench, describe } from "vitest";
import wwwConfig from "../../../../apps/www/sugarcube.config.js";
import { fillDefaults } from "../../src/node/config/normalize.js";
import { declare } from "../../src/shared/css/declare.js";
import { emitCSS } from "../../src/shared/css/emit.js";
import { readOptions } from "../../src/shared/read-options.js";
import { utilityRules } from "../../src/shared/utilities/rules.js";
import { utilityTokens } from "../../src/shared/utilities/tokens.js";
import type { UtilityClassesConfig } from "../../src/types/config.js";

const repo = join(import.meta.dirname, "../../../..");
const kits = join(repo, "apps/www/registry/tokens/starter-kits");

const kitClasses = wwwConfig.utilities?.classes;
ok(kitClasses, "the fluid kit's config lists utility classes");
const classes: UtilityClassesConfig = {};
for (const [property, entry] of Object.entries(kitClasses)) {
    classes[property] = [entry].flat().map((each) => Object.assign({}, each, { safelist: true }));
}

async function project(resolver: string) {
    const config = fillDefaults({
        resolver,
        variables: { path: "variables.css" },
        utilities: { classes },
    });
    const doc = await read(resolver, readOptions(config));
    return { config, doc };
}

type Rule = [RegExp, (match: RegExpMatchArray) => Record<string, unknown> | undefined];

function answerEach(rules: Rule[], classNames: string[]) {
    for (const className of classNames) {
        rules.reduceRight<Record<string, unknown> | undefined>((found, [pattern, handler]) => {
            if (found) return found;
            const match = className.match(pattern);
            const css = match ? handler(match) : undefined;
            return css && Object.keys(css).length > 0 ? css : undefined;
        }, undefined);
    }
}

const projects = {
    "the static starter kit (463 tokens)": await project(join(kits, "static/tokens.resolver.json")),
    "the fluid starter kit (489 tokens)": await project(join(kits, "fluid/tokens.resolver.json")),
    "Studio's design tokens (210 tokens)": await project(
        join(repo, "packages/studio/src/design-tokens/tokens.resolver.json"),
    ),
};

for (const [name, { config, doc }] of Object.entries(projects)) {
    describe(`utilities for ${name}, the fluid kit's classes, each safelisted class answered`, () => {
        const declared = declare(doc, config);

        bench("new core: tokens, rules, safelist, answers, from the build's declarations", () => {
            const { rules, safelist } = utilityRules(utilityTokens(declared), classes);
            answerEach(rules, safelist);
        });

        bench("new core: the token list alone", () => {
            utilityTokens(declared);
        });

        bench("new core: declare, for scale", () => {
            declare(doc, config);
        });

        bench("new core: emitCSS, for scale", () => {
            emitCSS(declared, config);
        });
    });
}
