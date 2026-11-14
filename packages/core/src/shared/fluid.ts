import {
    type DimensionValue,
    type ParseOptions,
    type Token,
    defineExtensionValidator,
} from "@sugarcube-sh/dtcg";
import {
    type ExtensionResult,
    createExtensionReader,
    isJsonObject,
} from "@sugarcube-sh/dtcg/values";
import { ErrorMessages } from "./constants/error-messages.js";
import { SUGARCUBE_NAMESPACE } from "./extensions.js";

export interface FluidRange {
    min: DimensionValue;
    max: DimensionValue;
}

type Messages = typeof ErrorMessages.FLUID_EXTENSION;

export function readFluid(
    extension: unknown,
    options: ParseOptions,
): ExtensionResult<FluidRange | undefined, Messages> {
    if (!isJsonObject(extension) || !Object.hasOwn(extension, "fluid"))
        return { ok: true, value: undefined };
    const { fluid } = extension;
    const reader = createExtensionReader<Messages>(options);
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

export function findFluidRange(
    from: Token,
    options: ParseOptions,
): { token: Token; range: FluidRange } | undefined {
    for (const each of from.aliasChain) {
        if (each.type !== "dimension" || each.resolved === undefined) return undefined;
        const fluid = readFluid(each.extensions?.[SUGARCUBE_NAMESPACE], options);
        if (!fluid.ok) return undefined;
        if (fluid.value) return { token: each, range: fluid.value };
    }
    return undefined;
}

export function toPixels({ value, unit }: DimensionValue): number {
    return unit === "px" ? value : value * 16;
}

export const fluidValidator = defineExtensionValidator({
    key: SUGARCUBE_NAMESPACE,
    appliesTo: ["dimension"],
    messages: ErrorMessages.FLUID_EXTENSION,
    validate: (_token, ours, options) => readFluid(ours, options),
});
