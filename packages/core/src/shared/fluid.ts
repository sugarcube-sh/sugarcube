import {
    type DimensionValue,
    type ExtensionError,
    type ValueError,
    defineExtensionValidator,
} from "@sugarcube-sh/dtcg";
import { parseValue } from "@sugarcube-sh/dtcg/values";
import { ErrorMessages } from "./constants/error-messages.js";
import { SUGARCUBE_NAMESPACE } from "./extensions.js";

export interface FluidRange {
    min: DimensionValue;
    max: DimensionValue;
}

type Errors = (ExtensionError<typeof ErrorMessages.FLUID_EXTENSION> | ValueError)[];

export function readFluid(
    ours: unknown,
): { ok: true; value: FluidRange | undefined } | { ok: false; errors: Errors } {
    if (!isObject(ours) || !Object.hasOwn(ours, "fluid")) return { ok: true, value: undefined };
    const { fluid } = ours;
    if (!isObject(fluid)) {
        return {
            ok: false,
            errors: [{ path: ["fluid"], reason: "not-an-object", data: { name: "fluid" } }],
        };
    }
    const errors: Errors = [];
    const read = (end: "min" | "max") => {
        if (!Object.hasOwn(fluid, end)) {
            errors.push({ path: ["fluid"], reason: "missing-property", data: { name: end } });
            return undefined;
        }
        const result = parseValue("dimension", fluid[end], ["fluid", end], { references: false });
        if (result.ok) return result.value;
        errors.push(...result.errors);
        return undefined;
    };
    const [min, max] = [read("min"), read("max")];
    if (min && max) return { ok: true, value: { min, max } };
    return { ok: false, errors };
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

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
