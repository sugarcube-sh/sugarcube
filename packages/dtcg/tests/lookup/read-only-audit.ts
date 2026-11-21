import { join } from "node:path";
import ts from "typescript";

const packages = join(import.meta.dirname, "../../..");

const entries = {
    dtcg: ["dtcg/src/index.ts", "dtcg/src/node.ts", "dtcg/src/values.ts", "dtcg/src/css.ts"],
};

const KEEP_THEIR_ANSWERS = [["dtcg/src/css.ts", "CSSWriter"]] as const;

export type Package = keyof typeof entries;

export interface Breaks {
    snapshot: string[];
    parameters: Record<Package, string[]>;
}

type Role = "snapshot" | "input" | "result" | "call" | "answer";

const internals = ts as unknown as {
    getCheckFlags(symbol: ts.Symbol): number;
    CheckFlags: { Readonly: number };
};

export function readOnlyBreaks(): Breaks {
    const program = ts.createProgram(
        Object.values(entries)
            .flat()
            .map((file) => join(packages, file)),
        {
            strict: true,
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.ESNext,
            moduleResolution: ts.ModuleResolutionKind.Bundler,
            skipLibCheck: true,
            noEmit: true,
            paths: {
                "@sugarcube-sh/dtcg": [join(packages, "dtcg/src/index.ts")],
                "@sugarcube-sh/dtcg/*": [join(packages, "dtcg/src/*.ts")],
            },
        },
    );
    const checker = program.getTypeChecker();
    const snapshot = new Set<string>();
    const parameters: Record<Package, Set<string>> = { dtcg: new Set() };
    const visited = new Set<string>();

    const packageOf = (node: ts.Node): Package | undefined => {
        const file = node.getSourceFile().fileName;
        if (file.includes("/dtcg/src/")) return "dtcg";
        return undefined;
    };
    const ours = (type: ts.Type): boolean => {
        const symbol = type.aliasSymbol ?? type.getSymbol();
        return !symbol || (symbol.getDeclarations() ?? []).some((each) => packageOf(each));
    };
    const nameOf = (type: ts.Type): string | undefined => {
        const name = type.aliasSymbol?.name ?? type.getSymbol()?.name;
        return name && !name.startsWith("__") ? name : undefined;
    };
    const listKind = (type: ts.Type): "list" | "readonly list" | undefined => {
        const reference = type as ts.TypeReference;
        if (!(type.flags & ts.TypeFlags.Object)) return undefined;
        if (!((type as ts.ObjectType).objectFlags & ts.ObjectFlags.Reference)) return undefined;
        const target = reference.target as ts.TupleType;
        if (target.objectFlags & ts.ObjectFlags.Tuple)
            return target.readonly ? "readonly list" : "list";
        const name = target.getSymbol()?.name;
        if (name === "Array") return "list";
        if (name === "ReadonlyArray") return "readonly list";
        return undefined;
    };
    const readOnly = (symbol: ts.Symbol): boolean => {
        if (internals.getCheckFlags(symbol) & internals.CheckFlags.Readonly) return true;
        const declarations = symbol.getDeclarations() ?? [];
        return (
            declarations.length > 0 &&
            declarations.every((declaration) => {
                if (ts.isGetAccessorDeclaration(declaration)) {
                    return !declarations.some((other) => ts.isSetAccessorDeclaration(other));
                }
                const modifiers = ts.canHaveModifiers(declaration)
                    ? ts.getModifiers(declaration)
                    : [];
                return (modifiers ?? []).some(
                    (each) => each.kind === ts.SyntaxKind.ReadonlyKeyword,
                );
            })
        );
    };

    const walk = (type: ts.Type, role: Role, where: string, from?: Package): void => {
        if (listKind(type) === "list") {
            if (role === "snapshot") snapshot.add(`${where}: a list that can be changed in place`);
            if (role === "input" && from) parameters[from].add(where);
        }
        const key = `${role}:${(type as { id?: number }).id}`;
        if (
            visited.has(key) ||
            (role !== "snapshot" && visited.has(`snapshot:${(type as { id?: number }).id}`))
        ) {
            return;
        }
        visited.add(key);
        if (type.isUnion() || type.isIntersection()) {
            for (const each of type.types) walk(each, role, where, from);
            return;
        }
        if (!(type.flags & ts.TypeFlags.Object)) return;
        if (listKind(type)) {
            for (const element of checker.getTypeArguments(type as ts.TypeReference)) {
                walk(element, role, `${where}[]`, from);
            }
            return;
        }
        if (!ours(type)) return;
        const name = nameOf(type) ?? where;
        for (const signature of [...type.getCallSignatures(), ...type.getConstructSignatures()]) {
            for (const parameter of signature.getParameters()) {
                const declaration = parameter.getDeclarations()?.[0];
                const owner = declaration && packageOf(declaration);
                walk(
                    checker.getTypeOfSymbol(parameter),
                    "input",
                    `${where}(${parameter.name})`,
                    owner,
                );
            }
            const returns = role === "answer" ? "snapshot" : "result";
            walk(signature.getReturnType(), returns, `${where}() returns`);
        }
        for (const info of checker.getIndexInfosOfType(type)) {
            if (role === "snapshot" && !info.isReadonly)
                snapshot.add(`${name}[key]: can be assigned`);
            walk(info.type, role, `${name}[key]`, from);
        }
        for (const property of checker.getPropertiesOfType(type)) {
            const label = `${name}.${property.name}`;
            const propertyType = checker.getTypeOfSymbol(property);
            if (property.flags & ts.SymbolFlags.Method) {
                walk(propertyType, role === "snapshot" ? "answer" : "call", label);
                continue;
            }
            if (role === "snapshot" && !readOnly(property))
                snapshot.add(`${label}: can be assigned`);
            walk(propertyType, role, label, from);
        }
    };

    const dtcg = checker.getSymbolAtLocation(
        program.getSourceFile(join(packages, entries.dtcg[0]!))!,
    )!;
    const designTokens = checker
        .getExportsOfModule(dtcg)
        .find(({ name }) => name === "DesignTokens")!;
    walk(checker.getDeclaredTypeOfSymbol(designTokens), "snapshot", "DesignTokens");
    for (const [file, name] of KEEP_THEIR_ANSWERS) {
        const module = checker.getSymbolAtLocation(program.getSourceFile(join(packages, file))!)!;
        const keeper = checker.getExportsOfModule(module).find((each) => each.name === name)!;
        walk(checker.getDeclaredTypeOfSymbol(keeper), "snapshot", name);
    }
    for (const [pkg, files] of Object.entries(entries)) {
        for (const file of files) {
            const module = checker.getSymbolAtLocation(
                program.getSourceFile(join(packages, file))!,
            );
            for (const exported of module ? checker.getExportsOfModule(module) : []) {
                const symbol =
                    exported.flags & ts.SymbolFlags.Alias
                        ? checker.getAliasedSymbol(exported)
                        : exported;
                const type = checker.getTypeOfSymbol(symbol);
                const label = `${pkg}: ${symbol.name}`;
                if (symbol.flags & (ts.SymbolFlags.Function | ts.SymbolFlags.Class)) {
                    walk(type, "call", label);
                } else if (symbol.flags & ts.SymbolFlags.Variable) {
                    const callable = type.getCallSignatures().length > 0;
                    walk(type, callable ? "call" : "snapshot", label);
                }
            }
        }
    }
    const sorted = (found: Set<string>) => [...found].sort();
    return {
        snapshot: sorted(snapshot),
        parameters: {
            dtcg: sorted(parameters.dtcg),
        },
    };
}
