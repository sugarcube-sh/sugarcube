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
): boolean {
    return hasEquivalentValue(a, b);
}

export function hasEquivalentValue(a: unknown, b: unknown): boolean {
    return deepEqual(a, b, valueRules);
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
