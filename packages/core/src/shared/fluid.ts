import {
    type DimensionValue,
    type ExtensionError,
    type ValueError,
    defineExtensionValidator,
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
): { ok: true; value: FluidRange | undefined } | { ok: false; errors: Errors } {
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

export const fluidValidator = defineExtensionValidator({
    key: SUGARCUBE_NAMESPACE,
    appliesTo: ["dimension"],
    messages: ErrorMessages.FLUID_EXTENSION,
    validate: (_token, ours) => {
        const read = readFluid(ours);
        return read.ok ? [] : read.errors;
    },
});
