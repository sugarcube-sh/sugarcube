import type {
    Alias,
    JsonPath,
    Parse,
    ParseResult,
    Pointer,
    TokenType,
    ValueError,
    WithAliases,
} from "../index.js";
import { isPlainObject, readAlias, readPointer } from "./references.js";
import { valueError } from "./value-errors.js";

type ObjectForm<T extends TokenType> = Exclude<WithAliases<T>, Alias | Pointer>;

export type PartReaders<T extends TokenType> = {
    readonly [K in keyof ObjectForm<T>]-?: Parse<ObjectForm<T>[K]>;
};

export function readComposite<T extends TokenType>(
    type: T,
    parts: PartReaders<T>,
    raw: unknown,
    at: JsonPath,
): ParseResult<WithAliases<T>> {
    const reference = readAlias(raw) ?? readPointer(raw);
    if (reference) return { ok: true, value: reference as WithAliases<T> };

    if (!isPlainObject(raw)) {
        return { ok: false, errors: [valueError(at, "wrong-shape", type)] };
    }

    const errors: ValueError[] = [];
    for (const name of Object.keys(raw)) {
        if (!Object.hasOwn(parts, name)) {
            errors.push(valueError([...at, name], "unknown-property", name, type));
        }
    }

    const value: Record<string, unknown> = {};
    for (const [name, read] of Object.entries(parts) as [string, Parse<unknown>][]) {
        if (!(name in raw)) {
            errors.push(valueError(at, "missing-property", name, type));
            continue;
        }

        const result = read(raw[name], [...at, name]);
        if (result.ok) value[name] = result.value;
        else errors.push(...result.errors);
    }

    if (errors.length > 0) return { ok: false, errors };
    return { ok: true, value: value as WithAliases<T> };
}
