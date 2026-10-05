import type { ParseOptions, TokenType, ValueByType } from "../index.js";
import { isJsonObject } from "./json.js";
import type { ValueErrorCode, ValueErrorFacts } from "./value-errors.js";

export type Problem = {
    [R in ValueErrorCode]: { reason: R } & ValueErrorFacts[R];
}[ValueErrorCode];

export type BareReason = {
    [R in ValueErrorCode]: keyof ValueErrorFacts[R] extends never ? R : never;
}[ValueErrorCode];

type ValueReason = {
    [R in ValueErrorCode]: ValueErrorFacts[R] extends { value: unknown }
        ? { value: unknown } extends ValueErrorFacts[R]
            ? R
            : never
        : never;
}[ValueErrorCode];

export type Refusal = (raw: unknown) => Problem;

export type Literal = { ok: true; value: unknown } | { ok: false; problem: Problem };

export type Siblings = Readonly<Record<string, unknown>>;

export interface OfTypeSyntax {
    readonly kind: "ofType";
    readonly type: TokenType;
    readonly hasParts: true;
    adjust?(value: unknown): unknown;
}

export interface ObjectSyntax {
    readonly kind: "object";
    readonly properties: Readonly<Record<string, PropertySyntax>>;
    readonly inOrder: readonly (readonly [string, PropertySyntax])[];
    readonly tag?: string;
    readonly hasParts: boolean;
}

export interface LiteralSyntax {
    readonly kind: "literal";
    readonly hasParts: false;
    readonly part?: string;
    read(raw: unknown, options: ParseOptions): Literal;
}

export interface OneOfSyntax {
    readonly kind: "oneOf";
    readonly choices: Readonly<Partial<Record<"string" | "number" | "boolean" | "object", Syntax>>>;
    readonly array?: ArraySyntax;
    readonly other: Syntax | Refusal;
    readonly hasParts: boolean;
}

export interface SingleSyntax {
    readonly kind: "single";
    readonly item: Syntax;
    readonly hasParts: boolean;
}

export type Syntax = OfTypeSyntax | ObjectSyntax | LiteralSyntax | OneOfSyntax | SingleSyntax;

export interface ListSyntax {
    readonly kind: "list";
    readonly item: Syntax;
    readonly empty?: BareReason;
    readonly hasParts: boolean;
}

export interface ElementsSyntax {
    readonly kind: "elements";
    readonly item: Syntax;
    readonly empty: BareReason;
    readonly parts: string;
    readonly hasParts: true;
}

export interface TupleSyntax {
    readonly kind: "tuple";
    readonly items: readonly Syntax[];
    readonly hasParts: boolean;
    wrongLength(raw: unknown[]): Problem;
}

export type ArraySyntax = ListSyntax | ElementsSyntax | TupleSyntax;

export interface WithDefault {
    readonly kind: "default";
    readonly syntax: Syntax;
    readonly value: unknown;
}

export interface Optional {
    readonly kind: "optional";
    readonly syntax: Syntax;
}

export interface DependsOn {
    readonly kind: "dependent";
    from(siblings: Siblings): Syntax;
}

export type PropertySyntax = Syntax | WithDefault | Optional | DependsOn;

export function ofType<T extends TokenType>(
    type: T,
    adjust?: (value: ValueByType[T]) => ValueByType[T],
): OfTypeSyntax & { readonly type: T } {
    return adjust
        ? { kind: "ofType", type, hasParts: true, adjust }
        : { kind: "ofType", type, hasParts: true };
}

export function object<P extends Readonly<Record<string, PropertySyntax>>>(
    properties: P,
    tag?: string,
): Omit<ObjectSyntax, "properties"> & { readonly properties: P } {
    const inOrder = Object.entries(properties);
    const hasParts = inOrder.some(([, property]) => syntaxOf(property, {}).hasParts);
    return tag === undefined
        ? { kind: "object", properties, inOrder, hasParts }
        : { kind: "object", properties, inOrder, hasParts, tag };
}

export function withDefault<S extends Syntax>(
    syntax: S,
    value: unknown,
): WithDefault & { readonly syntax: S } {
    return { kind: "default", syntax, value };
}

export function optional(syntax: Syntax): Optional {
    return { kind: "optional", syntax };
}

export function dependsOn(from: (siblings: Siblings) => Syntax): DependsOn {
    return { kind: "dependent", from };
}

export function literal(read: (raw: unknown, options: ParseOptions) => Literal): LiteralSyntax;
export function literal<N extends string>(
    read: (raw: unknown, options: ParseOptions) => Literal,
    part: N,
): LiteralSyntax & { readonly part: N };
export function literal(
    read: (raw: unknown, options: ParseOptions) => Literal,
    part?: string,
): LiteralSyntax {
    return part === undefined
        ? { kind: "literal", read, hasParts: false }
        : { kind: "literal", read, hasParts: false, part };
}

export function oneOf({
    array,
    other,
    ...choices
}: Partial<Record<"string" | "number" | "boolean" | "object", Syntax>> & {
    array?: ArraySyntax;
    other: Syntax | Refusal;
}): OneOfSyntax {
    const all = [...Object.values(choices), ...(array ? [array] : []), other];
    const hasParts = all.some((each) => typeof each !== "function" && each.hasParts);
    return array
        ? { kind: "oneOf", choices, array, other, hasParts }
        : { kind: "oneOf", choices, other, hasParts };
}

export function single(item: Syntax): SingleSyntax {
    return { kind: "single", item, hasParts: item.hasParts };
}

export function list(item: Syntax, empty?: BareReason): ListSyntax {
    const { hasParts } = item;
    return empty === undefined
        ? { kind: "list", item, hasParts }
        : { kind: "list", item, empty, hasParts };
}

export function elements(
    item: Syntax,
    { empty, parts }: { empty: BareReason; parts: string },
): ElementsSyntax {
    return { kind: "elements", item, empty, parts, hasParts: true };
}

export function tuple(
    items: readonly Syntax[],
    wrongLength: (raw: unknown[]) => Problem,
): TupleSyntax {
    return { kind: "tuple", items, wrongLength, hasParts: items.some((each) => each.hasParts) };
}

export function refuse(reason: ValueReason): Refusal {
    return (value) => ({ reason, value });
}

export function ok(value: unknown): Literal {
    return { ok: true, value };
}

export function no(problem: Problem): Literal {
    return { ok: false, problem };
}

export type Choice = Syntax | Refusal | { list: ArraySyntax; items: unknown[] };

export function choiceOf({ choices, array, other }: OneOfSyntax, json: unknown): Choice {
    if (Array.isArray(json)) return array ? { list: array, items: json } : other;
    const kind = jsonKind(json);
    return (kind && choices[kind]) || other;
}

export function syntaxOf(property: PropertySyntax, siblings: Siblings): Syntax {
    if (property.kind === "default" || property.kind === "optional") return property.syntax;
    return property.kind === "dependent" ? property.from(siblings) : property;
}

function jsonKind(json: unknown): keyof OneOfSyntax["choices"] | undefined {
    if (isJsonObject(json)) return "object";
    if (typeof json === "string") return "string";
    if (typeof json === "number") return "number";
    if (typeof json === "boolean") return "boolean";
    return undefined;
}
