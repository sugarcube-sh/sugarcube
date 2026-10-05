import type {
    Alias,
    ParseOptions,
    Pointer,
    TokenType,
    UnresolvedValueByType,
    ValueByType,
} from "../index.js";
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

export type Literal<V> = { ok: true; value: V } | { ok: false; problem: Problem };

export type Siblings = Readonly<Record<string, unknown>>;

declare const described: unique symbol;

interface Typed<V, U> {
    readonly [described]?: (value: V, read: U) => [V, U];
}

export interface TokenNode {
    readonly kind: "token";
    readonly type: TokenType;
    adjust?(value: unknown): unknown;
}

export interface ObjectNode {
    readonly kind: "object";
    readonly properties: Readonly<Record<string, PropertyNode>>;
    readonly tag?: string;
}

export interface ListNode {
    readonly kind: "list";
    readonly item: Node;
    readonly elements: boolean;
    readonly empty?: BareReason;
}

export interface TupleNode {
    readonly kind: "tuple";
    readonly items: readonly Node[];
    wrongLength(raw: unknown[]): Problem;
}

export interface LiteralNode {
    readonly kind: "literal";
    read(raw: unknown, options: ParseOptions): Literal<unknown>;
    readonly part?: string;
}

export interface FormsNode {
    readonly kind: "forms";
    readonly forms: Readonly<Partial<Record<Exclude<JsonKind, "array">, Node>>> & {
        readonly array?: ArrayNode;
    };
    readonly other: Node | Refusal;
}

export interface AsListNode {
    readonly kind: "asList";
    readonly item: Node;
}

export interface DefaultNode {
    readonly kind: "default";
    readonly shape: Node;
    readonly value: unknown;
}

export interface OptionalNode {
    readonly kind: "optional";
    readonly shape: Node;
}

export interface DependentNode {
    readonly kind: "dependent";
    from(siblings: Siblings): Node;
}

export type Node = TokenNode | ObjectNode | LiteralNode | FormsNode | AsListNode;

export type ArrayNode = ListNode | TupleNode;

export type PropertyNode = Node | DefaultNode | OptionalNode | DependentNode;

export type JsonKind = "string" | "number" | "boolean" | "array" | "object";

export type Shape<V, U> = Node & Typed<V, U>;

type ArrayShape<V, U> = ArrayNode & Typed<V, U>;

type ObjectShape<P, V, U> = Omit<ObjectNode, "properties"> & {
    readonly properties: P;
} & Typed<V, U>;

type Side = "value" | "read";

type Of<S, I extends Side> = S extends Typed<infer V, infer U> ? { value: V; read: U }[I] : never;

export type Described<T extends TokenType> = Shape<
    ValueByType[T],
    Exclude<UnresolvedValueByType[T], Alias>
>;

type PropertyShape<P> = P extends { kind: "default" | "optional"; shape: infer S }
    ? S
    : P extends { kind: "dependent"; from(siblings: Siblings): infer S }
      ? S
      : P;

type OptionalKey<P> = {
    [K in keyof P]: P[K] extends { kind: "optional" } ? K : never;
}[keyof P];

type Flat<T> = { [K in keyof T]: T[K] };

type ObjectOf<P, I extends Side> = Flat<
    { [K in Exclude<keyof P, OptionalKey<P>>]: Of<PropertyShape<P[K]>, I> } & {
        [K in OptionalKey<P>]?: Of<PropertyShape<P[K]>, I>;
    }
>;

type Properties = Readonly<Record<string, PropertyNode>>;

export function token<T extends TokenType>(
    type: T,
    adjust?: (value: ValueByType[T]) => ValueByType[T],
): TokenNode & Typed<ValueByType[T], UnresolvedValueByType[T]> & { readonly type: T } {
    return adjust ? { kind: "token", type, adjust } : { kind: "token", type };
}

export function object<P extends Properties>(
    properties: P,
): ObjectShape<P, ObjectOf<P, "value">, Pointer | ObjectOf<P, "read">>;
export function object<P extends Properties, K extends string>(
    properties: P,
    tag: K,
): ObjectShape<
    P,
    Flat<{ kind: K } & ObjectOf<P, "value">>,
    Pointer | Flat<{ kind: K } & ObjectOf<P, "read">>
>;
export function object(properties: Properties, tag?: string): ObjectNode {
    return tag === undefined ? { kind: "object", properties } : { kind: "object", properties, tag };
}

export function withDefault<S extends Node>(
    shape: S,
    value: Of<S, "value">,
): DefaultNode & { readonly shape: S } {
    return { kind: "default", shape, value };
}

export function optional<S extends Node>(shape: S): OptionalNode & { readonly shape: S } {
    return { kind: "optional", shape };
}

export function dependsOn<S extends Node>(
    from: (siblings: Siblings) => S,
): DependentNode & { from(siblings: Siblings): S } {
    return { kind: "dependent", from };
}

export function list<S extends Node>(
    item: S,
    empty?: BareReason,
): ArrayShape<Of<S, "value">[], Pointer | Of<S, "read">[]> {
    return empty === undefined
        ? { kind: "list", item, elements: false }
        : { kind: "list", item, elements: false, empty };
}

export function elements<S extends Node>(
    item: S,
    empty: BareReason,
): ArrayShape<Of<S, "value">[], Pointer | (Alias | Of<S, "read">)[]> {
    return { kind: "list", item, elements: true, empty };
}

export function tuple<const S extends readonly Node[]>(
    items: S,
    wrongLength: (raw: unknown[]) => Problem,
): ArrayShape<
    { -readonly [I in keyof S]: Of<S[I], "value"> },
    Pointer | { -readonly [I in keyof S]: Of<S[I], "read"> }
> {
    return { kind: "tuple", items, wrongLength };
}

export function literal<V>(
    read: (raw: unknown, options: ParseOptions) => Literal<V>,
): Shape<V, Pointer | V>;
export function literal<V, N extends string>(
    read: (raw: unknown, options: ParseOptions) => Literal<V>,
    part: N,
): LiteralNode & Typed<V, Pointer | V> & { readonly part: N };
export function literal<V>(
    read: (raw: unknown, options: ParseOptions) => Literal<V>,
    part?: string,
): LiteralNode {
    return part === undefined ? { kind: "literal", read } : { kind: "literal", read, part };
}

type FormsInput = Partial<Record<Exclude<JsonKind, "array">, Node>> & {
    array?: ArrayNode;
    other: Node | Refusal;
};

export function forms<F extends FormsInput>(
    written: F,
): Shape<Of<F[keyof F], "value">, Of<F[keyof F], "read">> {
    const { other, ...each } = written;
    return { kind: "forms", forms: each, other };
}

export function asList<S extends Node>(item: S): Shape<Of<S, "value">[], Of<S, "read">[]> {
    return { kind: "asList", item };
}

export function refuse(reason: ValueReason): Refusal {
    return (value) => ({ reason, value });
}

export function ok<V>(value: V): Literal<V> {
    return { ok: true, value };
}

export function no(problem: Problem): Literal<never> {
    return { ok: false, problem };
}
