import { relative } from "pathe";
import type { Impact, Unused } from "./answers.js";
import type { TokenUses } from "./uses.js";

export function toUnusedJSON({ unused, total }: Unused, { scanned }: TokenUses) {
    return {
        unused,
        total,
        scanned: {
            stylesheets: scanned.stylesheets.length,
            markup: scanned.markup.length,
        },
    };
}

export function toImpactJSON({ path, definitions, dependents, uses }: Impact) {
    return {
        token: path,
        definitions: definitions.map(({ token, file, permutations }) => ({
            value: token.original?.value,
            type: token.type,
            file,
            permutations: permutations.inputs,
        })),
        dependents: dependents.map((each) => ({ token: each.path, references: each.references })),
        uses: uses.map((use) => ({
            file: relative(process.cwd(), use.file),
            ...(use.line !== undefined && { line: use.line }),
            var: use.var,
            token: use.token,
            ...(use.class !== undefined && { class: use.class }),
        })),
    };
}
