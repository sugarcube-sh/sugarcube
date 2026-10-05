import type { JsonPath, Part, Token, TokenType } from "../index.js";
import { syntaxes } from "../values/syntaxes.js";
import { isJsonObject } from "../values/json.js";
import { type ArraySyntax, type Syntax, choiceOf, syntaxOf } from "../values/syntax.js";
import { referenceAt } from "./references.js";

/**
 * A token's value as its parts: the whole value, and within it each part of a composite, each
 * shadow layer or gradient stop, and each length of a dash pattern, every one with where it sits,
 * what it resolved to and the reference written there. `undefined` for a token with no resolved
 * value. An emitter writes each type, and asks of each part's `ref` whether to write a reference
 * to another token instead.
 *
 * @example
 * // a border written { "color": "{color.ink}", "width": { "value": 1, "unit": "px" }, "style": "solid" }
 * const border = parts(token);
 * if (border?.type === "border") {
 *   border.color.ref        // { alias: "color.ink" }
 *   border.width.resolved   // { value: 1, unit: "px" }
 * }
 */
export function parts(token: Token): Part | undefined {
    if (token.resolved === undefined) return undefined;
    return partOf(token, token.type, token.resolved, []) as Part;
}

type Built = Record<string, unknown>;

function partOf(token: Token, type: TokenType, resolved: unknown, at: JsonPath): unknown {
    const ref = referenceAt(token, at);
    const part: Built = ref ? { type, at, resolved, ref } : { type, at, resolved };
    addParts(token, part, syntaxes[type], resolved, at);
    return part;
}

function addParts(token: Token, part: Built, syntax: Syntax, resolved: unknown, at: JsonPath) {
    if (!syntax.hasParts) return;
    switch (syntax.kind) {
        case "object": {
            if (!isJsonObject(resolved)) return;
            if (syntax.tag !== undefined && resolved.kind !== syntax.tag) return;
            for (const [name, property] of syntax.inOrder) {
                const inner = syntaxOf(property, resolved);
                const found = partsAt(token, inner, resolved[name], [...at, name]);
                if (found !== undefined) part[name] = found;
            }
            return;
        }
        case "oneOf": {
            const choice = choiceOf(syntax, resolved);
            if (typeof choice === "function") return;
            if (!("list" in choice)) addParts(token, part, choice, resolved, at);
            else if (choice.list.kind === "elements") {
                part[choice.list.parts] = listParts(token, choice.list, choice.items, at);
            }
            return;
        }
        case "ofType":
        case "single":
            return;
    }
}

function partsAt(token: Token, syntax: Syntax, value: unknown, at: JsonPath): unknown {
    if (!syntax.hasParts) return undefined;
    if (syntax.kind === "ofType") return partOf(token, syntax.type, value, at);
    if (syntax.kind !== "oneOf") return undefined;
    const choice = choiceOf(syntax, value);
    if (typeof choice === "function") return undefined;
    return "list" in choice
        ? listParts(token, choice.list, choice.items, at)
        : partsAt(token, choice, value, at);
}

function listParts(token: Token, syntax: ArraySyntax, items: unknown[], at: JsonPath): unknown[] {
    switch (syntax.kind) {
        case "elements":
            return items.map((item, index) => {
                const where = [...at, index];
                const ref = referenceAt(token, where);
                const element: Built = ref
                    ? { at: where, resolved: item, ref }
                    : { at: where, resolved: item };
                addParts(token, element, syntax.item, item, where);
                return element;
            });
        case "list":
            return items.map((item, index) => partsAt(token, syntax.item, item, [...at, index]));
        case "tuple":
            return syntax.items.map((itemSyntax, index) =>
                partsAt(token, itemSyntax, items[index], [...at, index]),
            );
    }
}
