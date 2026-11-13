import type { Token } from "../model/token.js";
import type { TokenType, UnresolvedValue } from "../model/value.js";
import { isJsonObject } from "./json.js";

const ROUNDING = 0.0005;

/**
 * Checks whether two values of a type are the same value.
 *
 * Numbers within 0.0005 count as equal. Values in different units or color spaces aren't equal,
 * such as `16px` and `1rem`. References aren't followed.
 *
 * @param type - The token type of both values, such as `"dimension"`.
 * @param a - The first value, such as `{ value: 4, unit: "px" }`.
 * @param b - The second value.
 *
 * @example
 * // Two spellings of one dimension
 * isEquivalentValue("dimension", { value: 0.1 + 0.2, unit: "rem" }, { value: 0.3, unit: "rem" })
 * // => true
 */
export function isEquivalentValue<T extends TokenType>(
    type: T,
    a: UnresolvedValue<T>,
    b: UnresolvedValue<T>,
): boolean;
/**
 * Checks whether two tokens have the same type and value.
 *
 * References aren't followed. To compare final values, pass each token's `resolved` value and the
 * type.
 *
 * @param a - The first token, such as `light.getToken("color.primary")`.
 * @param b - The second token.
 *
 * @example
 * // color.primary differs between mode: light and mode: dark
 * isEquivalentValue(light.getToken("color.primary")!, dark.getToken("color.primary")!)
 * // => false
 */
export function isEquivalentValue(a: Token, b: Token): boolean;
export function isEquivalentValue(
    ...values: [TokenType, unknown, unknown] | [Token, Token]
): boolean {
    if (values.length === 3) return deepEqual(values[1], values[2], valueRules);
    const [a, b] = values;
    return a.type === b.type && hasEquivalentValue(a, b);
}

export interface ComparableValue {
    value?: unknown;
    original?: { value: unknown } | undefined;
}

export function hasEquivalentValue(a: ComparableValue, b: ComparableValue): boolean {
    if (a.value === undefined || b.value === undefined) {
        return a.value === b.value && isEqualJson(a.original?.value, b.original?.value);
    }
    return deepEqual(a.value, b.value, valueRules);
}

/**
 * Checks whether two JSON values are the same.
 *
 * Key order doesn't matter. List order does. Numbers must match exactly.
 *
 * @param a - The first value, such as `{ a: 1, b: [2] }`.
 * @param b - The second value.
 *
 * @example
 * // Key order doesn't matter
 * isEqualJson({ a: 1, b: [2] }, { b: [2], a: 1 })
 * // => true
 */
export function isEqualJson(a: unknown, b: unknown): boolean {
    return deepEqual(a, b, strictRules);
}

interface EqualityRules {
    numbers(a: number, b: number): boolean;
    keys(value: Record<string, unknown>): string[];
}

const strictRules: EqualityRules = {
    numbers: (a, b) => a === b,
    keys: (value) => Object.keys(value).filter((key) => value[key] !== undefined),
};

const valueRules: EqualityRules = {
    numbers: (a, b) => Math.abs(a - b) < ROUNDING + Number.EPSILON,
    keys: (value) => {
        const keys = strictRules.keys(value);
        return "colorSpace" in value ? keys.filter((key) => key !== "hex") : keys;
    },
};

function deepEqual(a: unknown, b: unknown, rules: EqualityRules): boolean {
    if (typeof a === "number" && typeof b === "number") return rules.numbers(a, b);
    if (Array.isArray(a) && Array.isArray(b)) {
        return a.length === b.length && a.every((each, index) => deepEqual(each, b[index], rules));
    }
    if (isJsonObject(a) && isJsonObject(b)) {
        const keys = rules.keys(a);
        return (
            keys.length === rules.keys(b).length &&
            keys.every((key) => deepEqual(a[key], b[key], rules))
        );
    }
    return a === b;
}
