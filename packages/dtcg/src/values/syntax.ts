import type { ParseOptions, TokenType, ValueByType } from "../model/index.js";
import { isJsonObject } from "./json.js";
import type { ValueErrorCode, ValueErrorDetailByCode } from "./value-errors.js";

export type Problem = {
    [R in ValueErrorCode]: { reason: R } & ValueErrorDetailByCode[R];
}[ValueErrorCode];

export type BareReason = {
    [R in ValueErrorCode]: keyof ValueErrorDetailByCode[R] extends never ? R : never;
}[ValueErrorCode];

type ValueReason = {
    [R in ValueErrorCode]: ValueErrorDetailByCode[R] extends { value: unknown }
        ? { value: unknown } extends ValueErrorDetailByCode[R]
            ? R
            : never
        : never;
}[ValueErrorCode];

export type ProblemFactory = (raw: unknown) => Problem;

export type LiteralResult = { ok: true; value: unknown } | { ok: false; problem: Problem };

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
    readonly hasParts: boolean;
}

export interface LiteralSyntax {
    readonly kind: "literal";
    readonly hasParts: false;
    readonly part?: string;
    read(raw: unknown, options: ParseOptions): LiteralResult;
}

export interface OneOfSyntax {
    readonly kind: "oneOf";
    readonly choices: Readonly<Partial<Record<"string" | "number" | "boolean" | "object", Syntax>>>;
    readonly array?: ArraySyntax;
    readonly other: Syntax | ProblemFactory;
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

export interface DependentSyntax {
    readonly kind: "dependent";
    from(siblings: Siblings): Syntax;
}

export type PropertySyntax = Syntax | WithDefault | Optional | DependentSyntax;

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
): Omit<ObjectSyntax, "properties"> & { readonly properties: P } {
    const inOrder = Object.entries(properties);
    const hasParts = inOrder.some(([, property]) => getSyntax(property, {}).hasParts);
    return { kind: "object", properties, inOrder, hasParts };
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

export function dependsOn(from: (siblings: Siblings) => Syntax): DependentSyntax {
    return { kind: "dependent", from };
}

export function literal(
    read: (raw: unknown, options: ParseOptions) => LiteralResult,
): LiteralSyntax;
export function literal<N extends string>(
    read: (raw: unknown, options: ParseOptions) => LiteralResult,
    part: N,
): LiteralSyntax & { readonly part: N };
export function literal(
    read: (raw: unknown, options: ParseOptions) => LiteralResult,
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
    other: Syntax | ProblemFactory;
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

const PATH = /^[A-Za-z][^\s.{}#]*(\.[^\s.{}#]+)+$/;

/**
 * A value of the wrong JSON shape.
 *
 * For a string such as `color.primary`, it suggests the reference `{color.primary}`.
 */
export function wrongShape(value: unknown): Problem {
    return typeof value === "string" && PATH.test(value)
        ? { reason: "wrong-shape", value, reference: `{${value}}` }
        : { reason: "wrong-shape", value };
}

export function reject(reason: ValueReason): ProblemFactory {
    return (value) => ({ reason, value });
}

export function ok(value: unknown): LiteralResult {
    return { ok: true, value };
}

export function err(problem: Problem): LiteralResult {
    return { ok: false, problem };
}

export type Choice = Syntax | ProblemFactory | { list: ArraySyntax; items: unknown[] };

export function chooseByKind({ choices, array, other }: OneOfSyntax, json: unknown): Choice {
    if (Array.isArray(json)) return array ? { list: array, items: json } : other;
    const kind = jsonKind(json);
    return (kind && choices[kind]) || other;
}

export function getSyntax(property: PropertySyntax, siblings: Siblings): Syntax {
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
