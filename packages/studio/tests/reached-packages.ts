import { existsSync, readFileSync } from "node:fs";
import { builtinModules } from "node:module";
import { dirname, resolve } from "node:path";
import ts from "typescript";

function sourceFile(path: string): string {
    const found = [`${path}.ts`, `${path}.tsx`, `${path}/index.ts`, path].find(existsSync);
    if (!found) throw new Error(`No source file for ${path}`);
    return found;
}

function packageName(specifier: string): string {
    const parts = specifier.split("/");
    return specifier.startsWith("@") ? `${parts[0]}/${parts[1]}` : (parts[0] ?? specifier);
}

function loadedSpecifiers(file: string): string[] {
    const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest);
    return source.statements.flatMap((statement) => {
        const loads =
            (ts.isImportDeclaration(statement) && !statement.importClause?.isTypeOnly) ||
            (ts.isExportDeclaration(statement) && !statement.isTypeOnly);
        const specifier = loads ? statement.moduleSpecifier : undefined;
        return specifier && ts.isStringLiteral(specifier) ? [specifier.text] : [];
    });
}

export function packagesReachedFrom(entry: string): string[] {
    const packages = new Set<string>();
    const seen = new Set<string>();
    const pending = [entry];
    for (let file = pending.pop(); file; file = pending.pop()) {
        if (seen.has(file)) continue;
        seen.add(file);
        for (const specifier of loadedSpecifiers(file)) {
            if (specifier.startsWith(".")) {
                pending.push(sourceFile(resolve(dirname(file), specifier)));
            } else if (!specifier.startsWith("node:") && !builtinModules.includes(specifier)) {
                packages.add(packageName(specifier));
            }
        }
    }
    return [...packages].sort();
}
