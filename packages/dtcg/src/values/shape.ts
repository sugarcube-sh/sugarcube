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

export type PropertyNode = (
    | { readonly shape: Node }
    | {
          from(siblings: Siblings): Node;
      }
) & { readonly default?: unknown; readonly optional?: true };

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
    readonly otherwise: Node | Refusal;
}

export interface AsListNode {
    readonly kind: "asList";
    readonly item: Node;
}

export type Node = TokenNode | ObjectNode | LiteralNode | FormsNode | AsListNode;

export type ArrayNode = ListNode | TupleNode;

export type JsonKind = "string" | "number" | "boolean" | "array" | "object";

export type Shape<V, U> = Node & Typed<V, U>;

type ObjectShape<P, V, U> = Omit<ObjectNode, "properties"> & { readonly properties: P } & Typed<
        V,
        U
    >;

export type ArrayShape<V, U> = ArrayNode & Typed<V, U>;

type ValueOf<S> = S extends Typed<infer V, infer _> ? V : never;

type ReadOf<S> = S extends Typed<infer _, infer U> ? U : never;

export type Described<T extends TokenType> = Shape<
    ValueByType[T],
    Exclude<UnresolvedValueByType[T], Alias>
>;

type PropertyInput =
    | {
          readonly shape: Typed<any, any> & Node;
          readonly default?: unknown;
          readonly optional?: true;
      }
    | {
          from(siblings: Siblings): Typed<any, any> & Node;
          readonly default?: unknown;
          readonly optional?: true;
      };

type PropertyShape<P> = P extends { shape: infer S }
    ? S
    : P extends { from(siblings: Siblings): infer S }
      ? S
      : never;

type OptionalKey<P> = {
    [K in keyof P]: P[K] extends { optional: true } ? K : never;
}[keyof P];

type Flat<T> = { [K in keyof T]: T[K] };

type ObjectValue<P> = Flat<
    { [K in Exclude<keyof P, OptionalKey<P>>]: ValueOf<PropertyShape<P[K]>> } & {
        [K in OptionalKey<P>]?: ValueOf<PropertyShape<P[K]>>;
    }
>;

type ObjectRead<P> = Flat<
    { [K in Exclude<keyof P, OptionalKey<P>>]: ReadOf<PropertyShape<P[K]>> } & {
        [K in OptionalKey<P>]?: ReadOf<PropertyShape<P[K]>>;
    }
>;

type Properties<P> = {
    readonly [K in keyof P]: PropertyInput & { readonly default?: ValueOf<PropertyShape<P[K]>> };
};

export function token<T extends TokenType>(
    type: T,
    adjust?: (value: ValueByType[T]) => ValueByType[T],
): TokenNode & Typed<ValueByType[T], UnresolvedValueByType[T]> & { readonly type: T } {
    return adjust ? { kind: "token", type, adjust } : { kind: "token", type };
}

export function object<P extends Properties<P>>(
    properties: P,
): ObjectShape<P, ObjectValue<P>, Pointer | ObjectRead<P>>;
export function object<P extends Properties<P>, K extends string>(
    properties: P,
    tag: K,
): ObjectShape<P, Flat<{ kind: K } & ObjectValue<P>>, Pointer | Flat<{ kind: K } & ObjectRead<P>>>;
export function object<P extends Properties<P>>(properties: P, tag?: string): ObjectNode {
    return tag === undefined ? { kind: "object", properties } : { kind: "object", properties, tag };
}

export function list<S extends Node>(
    item: S,
    empty?: BareReason,
): ArrayShape<ValueOf<S>[], Pointer | ReadOf<S>[]> {
    return empty === undefined
        ? { kind: "list", item, elements: false }
        : { kind: "list", item, elements: false, empty };
}

export function elements<S extends Node>(
    item: S,
    empty: BareReason,
): ArrayShape<ValueOf<S>[], Pointer | (Alias | ReadOf<S>)[]> {
    return { kind: "list", item, elements: true, empty };
}

export function tuple<const S extends readonly Node[]>(
    items: S,
    wrongLength: (raw: unknown[]) => Problem,
): ArrayShape<
    { -readonly [I in keyof S]: ValueOf<S[I]> },
    Pointer | { -readonly [I in keyof S]: ReadOf<S[I]> }
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

type FormsInput = Partial<Record<Exclude<JsonKind, "array">, Node>> & { array?: ArrayNode };

export function forms<F extends FormsInput, O extends Node | Refusal>(
    written: F,
    otherwise: O,
): Shape<ValueOf<F[keyof F]> | ValueOf<O>, ReadOf<F[keyof F]> | ReadOf<O>> {
    return { kind: "forms", forms: written, otherwise };
}

export function asList<S extends Node>(item: S): Shape<ValueOf<S>[], ReadOf<S>[]> {
    return { kind: "asList", item };
}

export function accepted<V>(value: V): Literal<V> {
    return { ok: true, value };
}

export function refusedAs(problem: Problem): Literal<never> {
    return { ok: false, problem };
}
