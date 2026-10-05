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
import { readList } from "./list.js";
import { readNumber } from "./number.js";
import { readAlias, readPointer } from "./references.js";
import { valueError } from "./value-errors.js";

type GradientStop = Exclude<ObjectForm<"gradient">[number], Alias | Pointer>;

const PARTS: PartReaders<GradientStop> = { color: readColor, position: readPosition };

export function readGradient(
    raw: unknown,
    at: JsonPath,
    options?: ParseOptions,
): ParseResult<UnresolvedValue<"gradient">> {
    const reference = readAlias(raw) ?? readPointer(raw);
    if (reference) return { ok: true, value: reference, ignored: [] };

    if (!Array.isArray(raw)) {
        return {
            ok: false,
            errors: [valueError(at, { type: "gradient", reason: "wrong-shape", value: raw })],
            ignored: [],
        };
    }

    if (raw.length === 0) {
        return {
            ok: false,
            errors: [valueError(at, { type: "gradient", reason: "no-gradient-stops" })],
            ignored: [],
        };
    }
    return readList(raw, at, readStop, options);
}

function readStop(raw: unknown, at: JsonPath, options?: ParseOptions) {
    return readComposite("gradient", PARTS, raw, at, options);
}

function readPosition(raw: unknown, at: JsonPath): ParseResult<GradientStop["position"]> {
    const result = readNumber(raw, at);
    if (!result.ok || typeof result.value !== "number") return result;
    return { ...result, value: Math.min(1, Math.max(0, result.value)) };
}
