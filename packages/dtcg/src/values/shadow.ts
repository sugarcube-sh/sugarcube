import type { Alias, JsonPath, ParseResult, Pointer, UnresolvedValue } from "../index.js";
import { readColor } from "./color.js";
import { type ObjectForm, type PartReaders, readComposite } from "./composite.js";
import { readDimension } from "./dimension.js";
import { readList } from "./list.js";
import { readAlias, readPointer } from "./references.js";
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

export function readShadow(raw: unknown, at: JsonPath): ParseResult<UnresolvedValue<"shadow">> {
    const reference = readAlias(raw) ?? readPointer(raw);
    if (reference) return { ok: true, value: reference };

    if (!Array.isArray(raw)) {
        const layer = readLayer(raw, at);
        if (!layer.ok) return layer;
        return { ok: true, value: [layer.value] };
    }

    if (raw.length === 0) {
        return { ok: false, errors: [valueError(at, "no-shadows")] };
    }
    return readList(raw, at, readLayer);
}

function readLayer(raw: unknown, at: JsonPath) {
    return readComposite("shadow", PARTS, raw, at, DEFAULTS);
}

function readInset(raw: unknown, at: JsonPath): ParseResult<boolean | Pointer> {
    const pointer = readPointer(raw);
    if (pointer) return { ok: true, value: pointer };

    if (typeof raw === "boolean") return { ok: true, value: raw };
    return { ok: false, errors: [valueError(at, "not-a-boolean", raw)] };
}
