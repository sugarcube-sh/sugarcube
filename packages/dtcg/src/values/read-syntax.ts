import type {
    IgnoredProperty,
    JsonPath,
    ParseOptions,
    ParseResult,
    TokenType,
    UnresolvedValueByType,
    ValueError,
    WrittenReference,
} from "../model.js";
import { syntaxes } from "./syntaxes.js";
import { isJsonObject } from "./json.js";
import { isReference, readCurlyBrace, readJsonPointer } from "./references.js";
import {
    type ArraySyntax,
    type ObjectSyntax,
    type Problem,
    type PropertySyntax,
    type Siblings,
    type Syntax,
    chooseByKind,
    ofType,
    getSyntax,
    wrongShape,
} from "./syntax.js";
import { unknownProperties } from "./unknown-properties.js";
import { valueError } from "./value-errors.js";

export interface Slot {
    syntax: Syntax;
    jsonPath: JsonPath;
    tokenType: TokenType;
    isElement: boolean;
}

export interface ReferenceInValue extends Slot {
    ref: WrittenReference;
    property: JsonPath;
}

export interface DeferredRead {
    property: JsonPath;
    jsonPath: JsonPath;
    raw: unknown;
    from(siblings: Siblings): Syntax;
    siblings: Siblings;
    tokenType: TokenType;
}

export interface ReadCollector {
    references: ReferenceInValue[];
    deferredReads: DeferredRead[];
}

interface ReadLocation {
    jsonPath: JsonPath;
    property: JsonPath;
    isElement: boolean;
}

interface ReadContext {
    options: ParseOptions;
    tokenType: TokenType;
    errors: ValueError[];
    ignored: IgnoredProperty[];
    notes: ReadCollector | undefined;
}

const FAILED = Symbol("failed");

export function readToken<T extends TokenType>(
    type: T,
    raw: unknown,
    jsonPath: JsonPath,
    options: ParseOptions = {},
    notes?: ReadCollector,
): ParseResult<UnresolvedValueByType[T]> {
    const syntax = ofType(type);
    const result = readSlot(
        { syntax, jsonPath, tokenType: type, isElement: false },
        raw,
        options,
        notes,
    );
    return result.ok ? { ...result, value: result.value as UnresolvedValueByType[T] } : result;
}

export function readSlot(
    { syntax, jsonPath, tokenType, isElement }: Slot,
    raw: unknown,
    options: ParseOptions,
    notes: ReadCollector | undefined,
): ParseResult<unknown> {
    const reading: ReadContext = { options, tokenType, errors: [], ignored: [], notes };
    const value = read(syntax, raw, { jsonPath, property: [], isElement }, reading);
    const { errors, ignored } = reading;
    return value === FAILED ? { ok: false, errors, ignored } : { ok: true, value, ignored };
}

function read(syntax: Syntax, raw: unknown, where: ReadLocation, reading: ReadContext): unknown {
    const pointer = readJsonPointer(raw);
    if (pointer) return recordReference(pointer, syntax, where, reading);

    if (typeof raw === "string") {
        const curly = readCurlyBrace(raw);
        if (curly && (where.isElement || syntax.kind === "ofType")) {
            return recordReference(curly, syntax, where, reading);
        }
        if (curly)
            return fail(where, { reason: "curly-brace-not-allowed-here", reference: raw }, reading);
    }

    return readSyntax(syntax, raw, where, reading);
}

function readSyntax(
    syntax: Syntax,
    raw: unknown,
    where: ReadLocation,
    reading: ReadContext,
): unknown {
    switch (syntax.kind) {
        case "ofType": {
            const owner = reading.tokenType;
            reading.tokenType = syntax.type;
            const value = readSyntax(syntaxes[syntax.type], raw, where, reading);
            reading.tokenType = owner;
            return value !== FAILED && syntax.adjust ? syntax.adjust(value) : value;
        }
        case "object":
            return readObject(syntax, raw, where, reading);
        case "literal": {
            const literal = syntax.read(raw, reading.options);
            return literal.ok ? literal.value : fail(where, literal.problem, reading);
        }
        case "oneOf": {
            const choice = chooseByKind(syntax, raw);
            if (typeof choice === "function") return fail(where, choice(raw), reading);
            if ("list" in choice) return readList(choice.list, choice.items, where, reading);
            return readSyntax(choice, raw, where, reading);
        }
        case "single": {
            const one = { ...where, property: [...where.property, 0] };
            const value = readSyntax(syntax.item, raw, one, reading);
            return value === FAILED ? FAILED : [value];
        }
    }
}

function readObject(
    syntax: ObjectSyntax,
    raw: unknown,
    where: ReadLocation,
    reading: ReadContext,
): unknown {
    if (!isJsonObject(raw)) return fail(where, wrongShape(raw), reading);

    const { errors, options, tokenType } = reading;
    const isKnownProperty = (name: string) => Object.hasOwn(syntax.properties, name);
    const before = errors.length;
    reading.ignored.push(
        ...unknownProperties(raw, isKnownProperty, tokenType, where.jsonPath, errors, options),
    );

    const value: Record<string, unknown> = {};
    let failed = errors.length > before;
    for (const [name, property] of syntax.inOrder) {
        const childLocation = toChildLocation(where, name);
        if (!Object.hasOwn(raw, name)) {
            if (property.kind === "default") value[name] = property.value;
            else if (property.kind !== "optional") {
                failed = true;
                fail(childLocation, { reason: "missing-property", property: name }, reading);
            }
            continue;
        }
        const partSyntax = chooseSyntax(property, value, raw[name], childLocation, reading);
        const part = read(partSyntax, raw[name], childLocation, reading);
        if (part === FAILED) failed = true;
        else value[name] = part;
    }
    return failed ? FAILED : value;
}

function chooseSyntax(
    propertySyntax: PropertySyntax,
    siblings: Record<string, unknown>,
    raw: unknown,
    { jsonPath, property }: ReadLocation,
    reading: ReadContext,
): Syntax {
    if (propertySyntax.kind === "dependent" && Object.values(siblings).some(isReference)) {
        const { from } = propertySyntax;
        const { tokenType } = reading;
        reading.notes?.deferredReads.push({
            property,
            jsonPath,
            raw,
            from,
            siblings: { ...siblings },
            tokenType,
        });
    }
    return getSyntax(propertySyntax, siblings);
}

function readList(
    syntax: ArraySyntax,
    items: unknown[],
    where: ReadLocation,
    reading: ReadContext,
): unknown {
    let failed = false;
    const readItem = (itemSyntax: Syntax, item: unknown, index: number) => {
        const childLocation = toChildLocation(where, index, syntax.kind === "elements");
        const value = read(itemSyntax, item, childLocation, reading);
        if (value === FAILED) failed = true;
        return value;
    };

    if (syntax.kind === "tuple") {
        if (items.length !== syntax.items.length) {
            return fail(where, syntax.wrongLength(items), reading);
        }
        const values = syntax.items.map((itemSyntax, index) =>
            readItem(itemSyntax, items[index], index),
        );
        return failed ? FAILED : values;
    }

    if (items.length === 0 && syntax.empty) return fail(where, { reason: syntax.empty }, reading);
    const values = items.map((item, index) => readItem(syntax.item, item, index));
    return failed ? FAILED : values;
}

function toChildLocation(
    { jsonPath, property }: ReadLocation,
    step: string | number,
    isElement = false,
): ReadLocation {
    return { jsonPath: [...jsonPath, step], property: [...property, step], isElement };
}

function recordReference(
    ref: WrittenReference,
    syntax: Syntax,
    where: ReadLocation,
    reading: ReadContext,
) {
    const { jsonPath, property, isElement } = where;
    reading.notes?.references.push({
        ref,
        syntax,
        jsonPath,
        property,
        isElement,
        tokenType: reading.tokenType,
    });
    return ref;
}

function fail({ jsonPath }: ReadLocation, problem: Problem, reading: ReadContext): typeof FAILED {
    reading.errors.push(valueError(jsonPath, { type: reading.tokenType, ...problem }));
    return FAILED;
}
