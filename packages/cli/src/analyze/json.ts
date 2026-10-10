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

export function impactJSON({ token, dependents, uses }: Impact) {
    return {
        token: token.path,
        type: token.type,
        dependents: dependents.map(({ path, references }) => ({ token: path, references })),
        consumers: uses.map((use) => ({
            file: relative(process.cwd(), use.file),
            ...(use.line !== undefined && { line: use.line }),
            var: use.var,
            token: use.token,
            ...(use.class !== undefined && { class: use.class }),
        })),
    };
}
