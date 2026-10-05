import type {
    Alias,
    JsonPath,
    ParseOptions,
    ParseResult,
    Pointer,
    UnresolvedValue,
} from "../index.js";
import { readColor } from "./color.js";
import { type ObjectForm, type PartReaders, readComposite } from "./composite.js";
import { readDimension } from "./dimension.js";
import { readList } from "./list.js";
import { readAlias, readPointer } from "./references.js";
import { withIgnored } from "./set-aside.js";
import { valueError } from "./value-errors.js";

type ShadowLayer = Exclude<ObjectForm<"shadow">[number], Alias | Pointer>;

const PARTS: PartReaders<ShadowLayer> = {
    color: readColor,
    offsetX: readDimension,
    offsetY: readDimension,
    blur: readDimension,
    spread: readDimension,
    inset: readInset,
};

const DEFAULTS: Partial<ShadowLayer> = { inset: false };

export function readShadow(
    raw: unknown,
    at: JsonPath,
    options?: ParseOptions,
): ParseResult<UnresolvedValue<"shadow">> {
    const reference = readAlias(raw) ?? readPointer(raw);
    if (reference) return { ok: true, value: reference };

    if (!Array.isArray(raw)) {
        const layer = readLayer(raw, at, options);
        if (!layer.ok) return layer;
        return withIgnored({ ok: true, value: [layer.value] }, layer.ignored ?? []);
    }

    if (raw.length === 0) {
        return { ok: false, errors: [valueError(at, { type: "shadow", reason: "no-shadows" })] };
    }
    return readList(raw, at, readLayer, options);
}

function readLayer(raw: unknown, at: JsonPath, options?: ParseOptions) {
    return readComposite("shadow", PARTS, raw, at, options, DEFAULTS);
}

function readInset(raw: unknown, at: JsonPath): ParseResult<boolean | Pointer> {
    const pointer = readPointer(raw);
    if (pointer) return { ok: true, value: pointer };

    if (typeof raw === "boolean") return { ok: true, value: raw };
    return {
        ok: false,
        errors: [valueError(at, { type: "shadow", reason: "not-a-boolean", value: raw })],
    };
}
