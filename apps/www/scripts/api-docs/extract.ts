import { dirname, resolve } from "node:path";
import ts from "typescript";

export interface ApiDoc {
    description: string;
    examples: string[];
    see: string[];
    throws: string[];
    defaultValue?: string;
    returns?: string;
}

export interface ApiParam {
    name: string;
    type: string;
    optional: boolean;
    description: string;
}

export interface ApiSignature {
    params: ApiParam[];
    returns: string;
    typeParameters?: string;
    doc?: ApiDoc;
}

export interface ApiMember extends ApiDoc {
    name: string;
    kind: "property" | "method";
    type: string;
    optional: boolean;
    signatures: ApiSignature[];
    inheritedFrom?: string;
}

export type ApiSymbolKind = "function" | "class" | "interface" | "type" | "variable";

export interface ApiSymbol extends ApiDoc {
    name: string;
    kind: ApiSymbolKind;
    entry: string;
    signatures: ApiSignature[];
    members: ApiMember[];
    extendsTypes: string[];
    type?: string;
    typeParameters?: string;
    variants?: string[];
}

const WHITESPACE = /\s+/g;
const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g;
const COMMENT_END = /\*\/\s*$/;
const LINE_START = /^\s*\*\s?/;
const THROWN_TYPE = /^\{([A-Za-z_$][\w$.]*)\}/;
const LINE_COMMENT = /(^|\s)\/\/[^\n]*/g;

export function extractApi(
    sourceDirectory: string,
    entries: Record<string, string>,
    configFile: string,
): ApiSymbol[] {
    const files = Object.entries(entries).map(
        ([specifier, file]) => [specifier, resolve(sourceDirectory, file)] as const,
    );
    const program = ts.createProgram(
        files.map(([, file]) => file),
        { ...readCompilerOptions(configFile), types: ["node"] },
    );
    const checker = program.getTypeChecker();
    const isProject = (file: ts.SourceFile) =>
        !program.isSourceFileFromExternalLibrary(file) && !program.isSourceFileDefaultLibrary(file);
    const seen = new Set<ts.Symbol>();
    const symbols: ApiSymbol[] = [];
    for (const [specifier, file] of files) {
        const sourceFile = program.getSourceFile(file);
        const module = sourceFile && checker.getSymbolAtLocation(sourceFile);
        if (!module) throw new Error(`${specifier} (${file}) has no exports`);
        for (const exported of checker.getExportsOfModule(module)) {
            const target =
                exported.flags & ts.SymbolFlags.Alias
                    ? checker.getAliasedSymbol(exported)
                    : exported;
            if (seen.has(target)) continue;
            seen.add(target);
            const described = describeSymbol(checker, isProject, exported.name, target, specifier);
            if (described) symbols.push(described);
        }
    }
    return symbols;
}

function readCompilerOptions(configFile: string): ts.CompilerOptions {
    const { config, error } = ts.readConfigFile(configFile, ts.sys.readFile);
    if (error) throw new Error(ts.flattenDiagnosticMessageText(error.messageText, "\n"));
    return ts.parseJsonConfigFileContent(config, ts.sys, dirname(configFile)).options;
}

function describeSymbol(
    checker: ts.TypeChecker,
    isProject: (file: ts.SourceFile) => boolean,
    name: string,
    symbol: ts.Symbol,
    entry: string,
): ApiSymbol | undefined {
    const declaration = symbol.declarations?.[0];
    if (!declaration) return undefined;
    const base = {
        name,
        entry,
        ...readDoc(checker, symbol, declaration),
        signatures: [],
        members: [],
        extendsTypes: [],
    };
    if (symbol.flags & ts.SymbolFlags.Function) {
        const signatures = symbol
            .declarations!.filter(ts.isFunctionDeclaration)
            .filter((each) => !each.body || symbol.declarations!.length === 1);
        const described = signatures.map((each) =>
            describeSignature(checker, each, signatures.length > 1),
        );
        if (described.slice(1).some((each) => each.doc?.description)) {
            return { ...base, ...emptyDoc(), kind: "function", signatures: described };
        }
        const firstParams = described[0]?.params ?? [];
        for (const signature of described) {
            delete signature.doc;
            for (const param of signature.params) {
                param.description ||=
                    firstParams.find((each) => each.name === param.name)?.description ?? "";
            }
        }
        return { ...base, kind: "function", signatures: described };
    }
    if (symbol.flags & ts.SymbolFlags.Class) {
        const classDeclaration = declaration as ts.ClassDeclaration;
        const extendsTypes = (classDeclaration.heritageClauses ?? [])
            .filter((clause) => clause.token === ts.SyntaxKind.ExtendsKeyword)
            .flatMap((clause) => clause.types.map((each) => squash(each.getText())));
        const publicMembers = classDeclaration.members.filter(
            (member) =>
                !(
                    ts.getCombinedModifierFlags(member as ts.Declaration) &
                    (ts.ModifierFlags.Private |
                        ts.ModifierFlags.Protected |
                        ts.ModifierFlags.Static)
                ),
        );
        return {
            ...base,
            kind: "class",
            extendsTypes,
            members: describeMembers(checker, publicMembers),
        };
    }
    if (symbol.flags & ts.SymbolFlags.Interface) {
        const interfaceDeclaration = declaration as ts.InterfaceDeclaration;
        const extendsTypes = (interfaceDeclaration.heritageClauses ?? []).flatMap((clause) =>
            clause.types.map((each) => squash(each.getText())),
        );
        return {
            ...base,
            kind: "interface",
            extendsTypes,
            members: describeTypeMembers(checker, isProject, symbol),
        };
    }
    if (symbol.flags & ts.SymbolFlags.TypeAlias) {
        const alias = declaration as ts.TypeAliasDeclaration;
        const typeText = squash(alias.type.getText());
        const params = alias.typeParameters
            ? `<${alias.typeParameters.map((each) => squash(each.getText())).join(", ")}>`
            : "";
        const members =
            ts.isTypeLiteralNode(alias.type) || ts.isIntersectionTypeNode(alias.type)
                ? describeTypeMembers(checker, isProject, symbol)
                : [];
        const variants = ts.isUnionTypeNode(alias.type)
            ? alias.type.types.map((each) => squash(each.getText()))
            : undefined;
        return {
            ...base,
            kind: "type",
            type: typeText,
            ...(params && { typeParameters: params }),
            members,
            ...(variants && { variants }),
        };
    }
    if (symbol.flags & ts.SymbolFlags.Variable) {
        const variable = declaration as ts.VariableDeclaration;
        const initializer = variable.initializer && skipAsConst(variable.initializer);
        if (
            initializer &&
            ts.isObjectLiteralExpression(initializer) &&
            initializer.properties.some(ts.isMethodDeclaration)
        ) {
            return {
                ...base,
                kind: "variable",
                members: describeMembers(checker, initializer.properties),
            };
        }
        const type = variable.type
            ? squash(variable.type.getText())
            : flat(
                  checker.typeToString(
                      checker.getTypeAtLocation(variable),
                      undefined,
                      ts.TypeFormatFlags.NoTruncation,
                  ),
              );
        return { ...base, kind: "variable", type };
    }
    return undefined;
}

function skipAsConst(expression: ts.Expression): ts.Expression {
    let current = expression;
    while (
        ts.isAsExpression(current) ||
        ts.isSatisfiesExpression(current) ||
        ts.isParenthesizedExpression(current)
    )
        current = current.expression;
    return current;
}

function describeTypeMembers(
    checker: ts.TypeChecker,
    isProject: (file: ts.SourceFile) => boolean,
    symbol: ts.Symbol,
): ApiMember[] {
    return checker
        .getPropertiesOfType(checker.getDeclaredTypeOfSymbol(symbol))
        .flatMap((property) => {
            const declarations = (property.declarations ?? []).filter((each) =>
                isProject(each.getSourceFile()),
            );
            if (!declarations.length) return [];
            const owner = ownerName(declarations[0]!.parent);
            const members = describeMembers(checker, declarations);
            return owner && owner !== symbol.name
                ? members.map((member) => ({ ...member, inheritedFrom: owner }))
                : members;
        });
}

function ownerName(node: ts.Node): string | undefined {
    if (ts.isInterfaceDeclaration(node) || ts.isClassDeclaration(node)) return node.name?.text;
    if (ts.isTypeLiteralNode(node) && ts.isTypeAliasDeclaration(node.parent))
        return node.parent.name.text;
    return undefined;
}

function describeMembers(checker: ts.TypeChecker, members: readonly ts.Node[]): ApiMember[] {
    const byName = new Map<string, ApiMember>();
    for (const member of members) {
        if (
            !(
                ts.isPropertySignature(member) ||
                ts.isMethodSignature(member) ||
                ts.isMethodDeclaration(member) ||
                ts.isPropertyDeclaration(member)
            )
        )
            continue;
        if (!member.name || !ts.isIdentifier(member.name)) continue;
        const name = member.name.text;
        const symbol = checker.getSymbolAtLocation(member.name);
        const doc = symbol ? readDoc(checker, symbol, member) : emptyDoc();
        if (ts.isMethodSignature(member) || ts.isMethodDeclaration(member)) {
            const existing = byName.get(name);
            const signature = describeSignature(checker, member, false);
            if (existing) {
                existing.signatures.push(signature);
                continue;
            }
            byName.set(name, {
                name,
                kind: "method",
                type: "",
                optional: Boolean(member.questionToken),
                signatures: [signature],
                ...doc,
            });
            continue;
        }
        const type = member.type ? squash(member.type.getText()) : "unknown";
        byName.set(name, {
            name,
            kind: "property",
            type,
            optional: Boolean(member.questionToken),
            signatures: [],
            ...doc,
        });
    }
    return [...byName.values()];
}

function describeSignature(
    checker: ts.TypeChecker,
    declaration: ts.SignatureDeclaration,
    ownDoc: boolean,
): ApiSignature {
    const symbol = declaration.name && checker.getSymbolAtLocation(declaration.name);
    const tags = ts.getJSDocTags(declaration);
    const paramDescriptions = new Map(
        tags
            .filter(ts.isJSDocParameterTag)
            .map(
                (tag) =>
                    [tag.name.getText(), tagText(tag.comment).replace(/^\s*-\s*/, "")] as const,
            ),
    );
    const documentedNames = [...paramDescriptions.keys()];
    const params = declaration.parameters.map((parameter, index) => {
        const name = ts.isIdentifier(parameter.name)
            ? parameter.name.text
            : (documentedNames[index] ?? "options");
        const type = parameter.type ? squash(parameter.type.getText()) : "unknown";
        return {
            name,
            type,
            optional: Boolean(parameter.questionToken || parameter.initializer),
            description: paramDescriptions.get(name) ?? "",
        };
    });
    const returns = declaration.type
        ? squash(declaration.type.getText())
        : flat(
              checker.typeToString(
                  checker.getSignatureFromDeclaration(declaration)!.getReturnType(),
              ),
          );
    const typeParameters = declaration.typeParameters?.length
        ? `<${declaration.typeParameters.map((each) => squash(each.getText())).join(", ")}>`
        : undefined;
    const doc = ownDoc && symbol ? readDocFromNode(checker, declaration) : undefined;
    return { params, returns, ...(typeParameters && { typeParameters }), ...(doc && { doc }) };
}

function emptyDoc(): ApiDoc {
    return { description: "", examples: [], see: [], throws: [] };
}

function readDoc(checker: ts.TypeChecker, symbol: ts.Symbol, node: ts.Node): ApiDoc {
    const fromNode = readDocFromNode(checker, node);
    if (fromNode.description) return fromNode;
    return {
        ...fromNode,
        description: ts.displayPartsToString(symbol.getDocumentationComment(checker)).trim(),
    };
}

function readDocFromNode(_checker: ts.TypeChecker, node: ts.Node): ApiDoc {
    const jsDoc = (node as { jsDoc?: ts.JSDoc[] }).jsDoc?.at(-1);
    const doc = emptyDoc();
    if (!jsDoc) return doc;
    doc.description = tagText(jsDoc.comment).trim();
    const tags = (jsDoc.tags ?? []).filter((tag) => tag.tagName.text !== "link");
    tags.forEach((tag, index) => {
        const name = tag.tagName.text;
        const text = tagText(tag.comment);
        if (name === "example") doc.examples.push(text.trim());
        else if (name === "see") doc.see.push(flat(text));
        else if (name === "throws")
            doc.throws.push(throwsText(node.getSourceFile().text, tag, tags[index + 1], jsDoc));
        else if (name === "default") doc.defaultValue = flat(text).replace(/^`|`$/g, "");
        else if (name === "returns") doc.returns = flat(text);
    });
    return doc;
}

function throwsText(
    source: string,
    tag: ts.JSDocTag,
    next: ts.JSDocTag | undefined,
    jsDoc: ts.JSDoc,
): string {
    const raw = source
        .slice(tag.tagName.end, next?.pos ?? jsDoc.end)
        .replace(COMMENT_END, "")
        .split("\n")
        .map((line) => line.replace(LINE_START, ""))
        .join(" ");
    return flat(raw).replace(THROWN_TYPE, "`$1`");
}

function tagText(comment: string | ts.NodeArray<ts.JSDocComment> | undefined): string {
    if (comment === undefined) return "";
    if (typeof comment === "string") return comment;
    return comment
        .map((part) => {
            if (ts.isJSDocLink(part) || ts.isJSDocLinkCode(part) || ts.isJSDocLinkPlain(part)) {
                return part.getText();
            }
            return part.text;
        })
        .join("");
}

function flat(text: string): string {
    return text.replace(WHITESPACE, " ").trim();
}

function squash(code: string): string {
    return flat(code.replace(BLOCK_COMMENT, "").replace(LINE_COMMENT, "$1"));
}
