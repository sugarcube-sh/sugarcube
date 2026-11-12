import { relative } from "pathe";
import type { Impact, Unused } from "./answers.js";
import type { Uses } from "./uses.js";

export function unusedJSON({ unused, total }: Unused, { scanned }: Uses) {
    return {
        unused,
        total,
        scanned: {
            forVarReferences: scanned.forVarReferences.length,
            forUtilityClasses: scanned.forUtilityClasses.length,
        },
    };
}

export function impactJSON({ path, written, dependents, uses }: Impact) {
    return {
        token: path,
        written: written.map(({ token, file, permutations }) => ({
            value: token.original?.value,
            type: token.type,
            file,
            permutations: permutations.inputs,
        })),
        dependents: dependents.map((each) => ({ token: each.path, references: each.references })),
        consumers: uses.map((use) => ({
            file: relative(process.cwd(), use.file),
            ...(use.line !== undefined && { line: use.line }),
            var: use.var,
            token: use.token,
            ...(use.class !== undefined && { class: use.class }),
        })),
    };
}
