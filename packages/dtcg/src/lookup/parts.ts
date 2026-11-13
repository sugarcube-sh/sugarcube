import type { JsonPath, Part, Token, TokenType } from "../model.js";
import { syntaxes } from "../values/syntaxes/index.js";
import { isJsonObject } from "../values/json.js";
import { type ArraySyntax, type Syntax, chooseByKind, getSyntax } from "../values/syntax.js";

export function buildParts(token: Token): Part | undefined {
    if (token.resolved === undefined) return undefined;
    return buildPart(token, token.type, token.resolved, []) as Part;
}

type PartObject = Record<string, unknown>;

function buildPart(token: Token, type: TokenType, resolved: unknown, property: JsonPath): unknown {
    const part = attachLocation(token, property, { type, resolved });
    addParts(token, part, syntaxes[type], resolved, property);
    return part;
}

function addParts(
    token: Token,
    part: PartObject,
    syntax: Syntax,
    resolved: unknown,
    property: JsonPath,
) {
    if (!syntax.hasParts) return;
    switch (syntax.kind) {
        case "object": {
            if (!isJsonObject(resolved)) return;
            for (const [name, propertySyntax] of syntax.inOrder) {
                const inner = getSyntax(propertySyntax, resolved);
                const found = buildPartWithSyntax(token, inner, resolved[name], [
                    ...property,
                    name,
                ]);
                if (found !== undefined) part[name] = found;
            }
            return;
        }
        case "oneOf": {
            const choice = chooseByKind(syntax, resolved);
            if (typeof choice === "function") return;
            if (!("list" in choice)) addParts(token, part, choice, resolved, property);
            else if (choice.list.kind === "elements") {
                part[choice.list.parts] = listParts(token, choice.list, choice.items, property);
            }
            return;
        }
        case "ofType":
        case "single":
            return;
    }
}

function buildPartWithSyntax(
    token: Token,
    syntax: Syntax,
    value: unknown,
    property: JsonPath,
): unknown {
    if (!syntax.hasParts) return undefined;
    if (syntax.kind === "ofType") return buildPart(token, syntax.type, value, property);
    if (syntax.kind !== "oneOf") return undefined;
    const choice = chooseByKind(syntax, value);
    if (typeof choice === "function") return undefined;
    return "list" in choice
        ? listParts(token, choice.list, choice.items, property)
        : buildPartWithSyntax(token, choice, value, property);
}

function listParts(
    token: Token,
    syntax: ArraySyntax,
    items: unknown[],
    property: JsonPath,
): unknown[] {
    switch (syntax.kind) {
        case "elements":
            return items.map((item, index) => {
                const where = [...property, index];
                const element = attachLocation(token, where, { resolved: item });
                addParts(token, element, syntax.item, item, where);
                return element;
            });
        case "list":
            return items.map((item, index) =>
                buildPartWithSyntax(token, syntax.item, item, [...property, index]),
            );
        case "tuple":
            return syntax.items.map((itemSyntax, index) =>
                buildPartWithSyntax(token, itemSyntax, items[index], [...property, index]),
            );
    }
}

function attachLocation(token: Token, property: JsonPath, part: PartObject): PartObject {
    if (property.length > 0) part.property = property;
    const ref = token.getReferenceAt(property);
    if (ref) part.ref = ref;
    return part;
}
