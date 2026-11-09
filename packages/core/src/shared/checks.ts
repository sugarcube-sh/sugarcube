import type { ConfigIssue, TypeName } from "../types/diagnostics.js";

export type Check<T> = (value: unknown, setting: string, issues: ConfigIssue[]) => value is T;

interface Optional<T> {
    readonly optional: Check<T>;
}

type Fields<T> = {
    readonly [K in keyof T]-?: undefined extends T[K]
        ? Optional<Exclude<T[K], undefined>>
        : Check<T[K]>;
};

export function optional<T>(check: Check<T>): Optional<T> {
    return { optional: check };
}

export const string: Check<string> = (value, setting, issues): value is string =>
    typeof value === "string" || wrongType(issues, setting, ["string"], value);

export const number: Check<number> = (value, setting, issues): value is number =>
    (typeof value === "number" && !Number.isNaN(value)) ||
    wrongType(issues, setting, ["number"], value);

export const boolean: Check<boolean> = (value, setting, issues): value is boolean =>
    typeof value === "boolean" || wrongType(issues, setting, ["boolean"], value);

export function func<F extends (...args: never[]) => unknown>(): Check<F> {
    return (value, setting, issues): value is F =>
        typeof value === "function" || wrongType(issues, setting, ["function"], value);
}

export const filled: Check<string> = (value, setting, issues): value is string => {
    if (!string(value, setting, issues)) return false;
    if (value !== "") return true;
    issues.push({ reason: "empty", setting });
    return false;
};

export function oneOf<T extends string>(values: Record<T, true>): Check<T> {
    return (value, setting, issues): value is T => {
        const allowed = Object.keys(values);
        if (typeof value !== "string") return wrongType(issues, setting, [], value, allowed);
        if (Object.hasOwn(values, value)) return true;
        issues.push({ reason: "not-allowed", setting, allowed, value });
        return false;
    };
}

export function matching(
    form: Extract<ConfigIssue, { reason: "wrong-form" }>["form"],
    pattern: RegExp,
): Check<string> {
    return (value, setting, issues): value is string => {
        if (!string(value, setting, issues)) return false;
        if (pattern.test(value)) return true;
        issues.push({ reason: "wrong-form", setting, value, form });
        return false;
    };
}

export function list<T>(each: Check<T>): Check<T[]> {
    return (value, setting, issues): value is T[] => {
        if (!Array.isArray(value)) return wrongType(issues, setting, ["array"], value);
        const before = issues.length;
        value.forEach((item, index) => each(item, place(setting, index), issues));
        return issues.length === before;
    };
}

export function oneOrList<A, B>(one: Check<A>, many: Check<B[]>): Check<A | B[]> {
    return (value, setting, issues): value is A | B[] => {
        if (Array.isArray(value)) return many(value, setting, issues);
        const own: ConfigIssue[] = [];
        if (one(value, setting, own)) return true;
        const [first] = own;
        if (own.length === 1 && first?.reason === "wrong-type" && first.setting === setting) {
            issues.push({ ...first, expected: [...first.expected, "array"] });
        } else {
            issues.push(...own);
        }
        return false;
    };
}

export function record<T>(each: Check<T>): Check<Record<string, T>> {
    return (value, setting, issues): value is Record<string, T> => {
        if (!isObject(value)) return wrongType(issues, setting, ["object"], value);
        const before = issues.length;
        for (const [key, item] of Object.entries(value)) each(item, place(setting, key), issues);
        return issues.length === before;
    };
}

export function object<T>(fields: Fields<T>): Check<T> {
    const entries = Object.entries(fields) as [string, Check<unknown> | Optional<unknown>][];
    return (value, setting, issues): value is T => {
        if (!isObject(value)) return wrongType(issues, setting, ["object"], value);
        const before = issues.length;
        for (const [key, field] of entries) {
            const item = value[key];
            if (typeof field !== "function") {
                if (item !== undefined) field.optional(item, place(setting, key), issues);
            } else if (item === undefined) {
                issues.push({ reason: "missing", setting, property: key });
            } else {
                field(item, place(setting, key), issues);
            }
        }
        for (const key of Object.keys(value)) {
            if (!Object.hasOwn(fields, key))
                issues.push({ reason: "unknown", setting: place(setting, key) });
        }
        return issues.length === before;
    };
}

function typeName(value: unknown): TypeName {
    if (value === null) return "null";
    if (Array.isArray(value)) return "array";
    if (Number.isNaN(value)) return "NaN";
    return typeof value;
}

function wrongType(
    issues: ConfigIssue[],
    setting: string,
    expected: TypeName[],
    value: unknown,
    allowed?: string[],
): false {
    const received = typeName(value);
    issues.push(
        allowed
            ? { reason: "wrong-type", setting, expected, received, allowed }
            : { reason: "wrong-type", setting, expected, received },
    );
    return false;
}

function place(setting: string, key: string | number): string {
    return setting ? `${setting}.${key}` : String(key);
}

export function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
