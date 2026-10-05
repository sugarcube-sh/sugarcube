import type {
    Alias,
    UnresolvedValueByType,
    JsonPath,
    Parse,
    ParseOptions,
    ParseResult,
    Pointer,
    TokenType,
    ValueError,
    UnresolvedValue,
} from "../index.js";
import { isJsonObject } from "./json.js";
import { readAlias, readPointer } from "./references.js";
import { unknownProperties } from "./unknown-properties.js";
import { refused, valueError } from "./value-errors.js";

export type ObjectForm<T extends TokenType> = Exclude<UnresolvedValue<T>, Alias | Pointer>;

export type PartReaders<O> = {
    readonly [K in keyof O]-?: Parse<O[K]>;
};

export function readComposite<O extends object>(
    type: keyof UnresolvedValueByType,
    parts: PartReaders<O>,
    raw: unknown,
    at: JsonPath,
    options: ParseOptions | undefined,
    defaults: Partial<O> = {},
): ParseResult<O | Alias | Pointer> {
    const reference = readAlias(raw) ?? readPointer(raw);
    if (reference) return { ok: true, value: reference, ignored: [] };

    if (!isJsonObject(raw)) {
        return refused(at, { type, reason: "wrong-shape", value: raw });
    }

    const errors: ValueError[] = [];
    const ignored = unknownProperties(
        raw,
        (name) => Object.hasOwn(parts, name),
        type,
        at,
        errors,
        options,
    );

    const value: Record<string, unknown> = {};
    for (const [name, read] of Object.entries(parts) as [string, Parse<unknown>][]) {
        if (!(name in raw)) {
            if (Object.hasOwn(defaults, name)) {
                value[name] = defaults[name as keyof O];
            } else {
                errors.push(
                    valueError([...at, name], { type, reason: "missing-property", property: name }),
                );
            }
            continue;
        }

        const result = read(raw[name], [...at, name], options);
        ignored.push(...result.ignored);
        if (result.ok) value[name] = result.value;
        else errors.push(...result.errors);
    }

    if (errors.length > 0) return { ok: false, errors, ignored };
    return { ok: true, value: value as O, ignored };
}
