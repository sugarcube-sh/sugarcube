import {
    type DimensionValue,
    type ExtensionError,
    type IgnoredProperty,
    type Permutation,
    type Token,
    type ValueError,
    defineExtensionValidator,
    isAlias,
    referenceAt,
    token,
} from "@sugarcube-sh/dtcg";
import { extensionReader, isJsonObject } from "@sugarcube-sh/dtcg/values";
import { ErrorMessages } from "./constants/error-messages.js";
import { SUGARCUBE_NAMESPACE } from "./extensions.js";

export interface FluidRange {
    min: DimensionValue;
    max: DimensionValue;
}

type Messages = typeof ErrorMessages.FLUID_EXTENSION;
type Errors = (ExtensionError<Messages> | ValueError)[];

export function readFluid(
    ours: unknown,
):
    | { ok: true; value: FluidRange | undefined; ignored?: IgnoredProperty[] }
    | { ok: false; errors: Errors; ignored?: IgnoredProperty[] } {
    if (!isJsonObject(ours) || !Object.hasOwn(ours, "fluid")) return { ok: true, value: undefined };
    const { fluid } = ours;
    const reader = extensionReader<Messages>();
    if (!isJsonObject(fluid)) {
        reader.report(["fluid"], "not-an-object", { name: "fluid" });
        return reader.result<FluidRange>(undefined);
    }
    const [min, max] = (["min", "max"] as const).map((end) =>
        Object.hasOwn(fluid, end)
            ? reader.read("dimension", fluid[end], ["fluid", end])
            : reader.report(["fluid"], "missing-property", { name: end }),
    );
    return reader.result(min && max && { min, max });
}

export function fluidRangeOf(
    permutation: Permutation,
    from: Token,
): { token: Token; range: FluidRange } | undefined {
    if (from.type !== "dimension" || from.resolved === undefined) return undefined;
    const own = readFluid(from.extensions?.[SUGARCUBE_NAMESPACE]);
    if (!own.ok) return undefined;
    if (own.value) return { token: from, range: own.value };
    const whole = referenceAt(from, []);
    const target = whole && isAlias(whole) ? token(permutation, whole.alias) : undefined;
    return target && fluidRangeOf(permutation, target);
}

export function pixels({ value, unit }: DimensionValue): number {
    return unit === "px" ? value : value * 16;
}

export const fluidValidator = defineExtensionValidator({
    key: SUGARCUBE_NAMESPACE,
    appliesTo: ["dimension"],
    messages: ErrorMessages.FLUID_EXTENSION,
    validate: (_token, ours) => {
        const read = readFluid(ours);
        return [...(read.ignored ?? []), ...(read.ok ? [] : read.errors)];
    },
});
