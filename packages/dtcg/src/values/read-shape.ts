import type {
    Alias,
    IgnoredProperty,
    JsonPath,
    ParseOptions,
    ParseResult,
    Pointer,
    TokenType,
    UnresolvedValueByType,
    ValueError,
} from "../index.js";
import { descriptions } from "./descriptions.js";
import { isJsonObject } from "./json.js";
import { isAlias, isPointer, readAlias, readPointer } from "./references.js";
import type {
    ArrayNode,
    JsonKind,
    Node,
    ObjectNode,
    Problem,
    PropertyNode,
    Siblings,
} from "./shape.js";
import { unknownProperties } from "./unknown-properties.js";
import { valueError } from "./value-errors.js";

export interface Place {
    shape: Node;
    at: JsonPath;
    owner: TokenType;
    element: boolean;
}

export interface Found extends Place {
    ref: Alias | Pointer;
    place: JsonPath;
}

export interface Recheck {
    place: JsonPath;
    at: JsonPath;
    raw: unknown;
    from(siblings: Siblings): Node;
    siblings: Siblings;
    owner: TokenType;
}

export interface Noted {
    found: Found[];
    rechecks: Recheck[];
}

interface Reading {
    options: ParseOptions;
    owner: TokenType;
    errors: ValueError[];
    ignored: IgnoredProperty[];
    noted: Noted | undefined;
}

const FAILED = Symbol("failed");

export function readToken<T extends TokenType>(
    type: T,
    raw: unknown,
    at: JsonPath,
    options: ParseOptions = {},
    noted?: Noted,
): ParseResult<UnresolvedValueByType[T]> {
    const place = { shape: { kind: "token", type }, at, owner: type, element: false } as const;
    const read = readAt(place, raw, options, noted);
    return read.ok ? { ...read, value: read.value as UnresolvedValueByType[T] } : read;
}

export function readAt(
    { shape, at, owner, element }: Place,
    raw: unknown,
    options: ParseOptions,
    noted: Noted | undefined,
): ParseResult<unknown> {
    const reading: Reading = { options, owner, errors: [], ignored: [], noted };
    const value = readPlace(shape, raw, at, [], reading, element);
    const { errors, ignored } = reading;
    return value === FAILED ? { ok: false, errors, ignored } : { ok: true, value, ignored };
}

function readPlace(
    shape: Node,
    raw: unknown,
    at: JsonPath,
    place: JsonPath,
    reading: Reading,
    element: boolean,
): unknown {
    const pointer = readPointer(raw);
    if (pointer)
        return keep({ ref: pointer, at, place, shape, owner: reading.owner, element }, reading);

    if (typeof raw === "string") {
        const alias = readAlias(raw);
        if (alias && (element || shape.kind === "token")) {
            return keep({ ref: alias, at, place, shape, owner: reading.owner, element }, reading);
        }
        if (alias) return fail(at, { reason: "alias-not-allowed-here", reference: raw }, reading);
    }

    return readNode(shape, raw, at, place, reading);
}

function keep(found: Found, reading: Reading) {
    reading.noted?.found.push(found);
    return found.ref;
}

function fail(at: JsonPath, problem: Problem, reading: Reading): typeof FAILED {
    reading.errors.push(valueError(at, { type: reading.owner, ...problem }));
    return FAILED;
}

function readNode(
    shape: Node,
    raw: unknown,
    at: JsonPath,
    place: JsonPath,
    reading: Reading,
): unknown {
    switch (shape.kind) {
        case "token": {
            const owner = reading.owner;
            reading.owner = shape.type;
            const value = readNode(descriptions[shape.type], raw, at, place, reading);
            reading.owner = owner;
            return value !== FAILED && shape.adjust ? shape.adjust(value) : value;
        }
        case "object":
            return readObject(shape, raw, at, place, reading);
        case "literal": {
            const read = shape.read(raw, reading.options);
            return read.ok ? read.value : fail(at, read.problem, reading);
        }
        case "forms": {
            if (Array.isArray(raw)) {
                if (shape.forms.array) return readArray(shape.forms.array, raw, at, place, reading);
            } else {
                const kind = scalarOrObject(raw);
                const form = kind && shape.forms[kind];
                if (form) return readNode(form, raw, at, place, reading);
            }
            const { other } = shape;
            if (typeof other === "function") return fail(at, other(raw), reading);
            return readNode(other, raw, at, place, reading);
        }
        case "asList": {
            const value = readNode(shape.item, raw, at, [...place, 0], reading);
            return value === FAILED ? FAILED : [value];
        }
    }
}

function readObject(
    shape: ObjectNode,
    raw: unknown,
    at: JsonPath,
    place: JsonPath,
    reading: Reading,
): unknown {
    if (!isJsonObject(raw)) return fail(at, { reason: "wrong-shape", value: raw }, reading);

    const { properties } = shape;
    const defines = (name: string) => Object.hasOwn(properties, name);
    const { errors, options, owner } = reading;
    const before = errors.length;
    reading.ignored.push(...unknownProperties(raw, defines, owner, at, errors, options));

    const value: Record<string, unknown> = shape.tag === undefined ? {} : { kind: shape.tag };
    let failed = errors.length > before;
    for (const [name, property] of Object.entries(properties)) {
        if (!Object.hasOwn(raw, name)) {
            if (property.kind === "default") value[name] = property.value;
            else if (property.kind !== "optional") {
                failed = true;
                fail([...at, name], { reason: "missing-property", property: name }, reading);
            }
            continue;
        }
        const part = readPlace(
            partShape(property, value, raw[name], [...place, name], [...at, name], reading),
            raw[name],
            [...at, name],
            [...place, name],
            reading,
            false,
        );
        if (part === FAILED) failed = true;
        else value[name] = part;
    }
    return failed ? FAILED : value;
}

function partShape(
    property: PropertyNode,
    siblings: Record<string, unknown>,
    raw: unknown,
    place: JsonPath,
    at: JsonPath,
    reading: Reading,
): Node {
    if (property.kind === "default" || property.kind === "optional") return property.shape;
    if (property.kind !== "dependent") return property;
    if (Object.values(siblings).some(isReference)) {
        const { from } = property;
        const { owner } = reading;
        reading.noted?.rechecks.push({ place, at, raw, from, siblings: { ...siblings }, owner });
    }
    return property.from(siblings);
}

function readArray(
    shape: ArrayNode,
    raw: unknown[],
    at: JsonPath,
    place: JsonPath,
    reading: Reading,
): unknown {
    let failed = false;
    const read = (itemShape: Node, item: unknown, index: number, element: boolean) => {
        const value = readPlace(
            itemShape,
            item,
            [...at, index],
            [...place, index],
            reading,
            element,
        );
        if (value === FAILED) failed = true;
        return value;
    };

    if (shape.kind === "tuple") {
        if (raw.length !== shape.items.length) return fail(at, shape.wrongLength(raw), reading);
        const items = shape.items.map((itemShape, index) =>
            read(itemShape, raw[index], index, false),
        );
        return failed ? FAILED : items;
    }

    if (raw.length === 0 && shape.empty) return fail(at, { reason: shape.empty }, reading);
    const items = raw.map((item, index) => read(shape.item, item, index, shape.elements));
    return failed ? FAILED : items;
}

function scalarOrObject(raw: unknown): Exclude<JsonKind, "array"> | undefined {
    if (isJsonObject(raw)) return "object";
    if (typeof raw === "string") return "string";
    if (typeof raw === "number") return "number";
    if (typeof raw === "boolean") return "boolean";
    return undefined;
}

function isReference(value: unknown): boolean {
    return isAlias(value) || isPointer(value);
}
