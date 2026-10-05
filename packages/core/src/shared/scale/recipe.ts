import type { ExtensionError, ValueError } from "@sugarcube-sh/dtcg";
import { type ExtensionReader, extensionReader, isJsonObject } from "@sugarcube-sh/dtcg/values";
import type {
    ExponentialScaleConfig,
    MultiplierScaleConfig,
    ScaleExtension,
} from "../../types/extensions.js";
import { ErrorMessages } from "../constants/error-messages.js";
import { parseOptions } from "../parse-options.js";

type Messages = typeof ErrorMessages.SCALE_RECIPE;
type Reader = ExtensionReader<Messages>;
type Errors = (ExtensionError<Messages> | ValueError)[];

export function readScaleRecipe(
    raw: unknown,
): { ok: true; value: ScaleExtension } | { ok: false; errors: Errors } {
    const reader = extensionReader<Messages>(parseOptions);
    if (!isJsonObject(raw)) {
        reader.report([], "not-an-object", { name: "scale" });
        return reader.result<ScaleExtension>(undefined);
    }
    return reader.result(readRecipe(raw, reader));
}

function readRecipe(recipe: Record<string, unknown>, reader: Reader): ScaleExtension | undefined {
    const { mode } = recipe;
    if (mode === undefined) reader.report(["mode"], "missing-property", { name: "mode" });
    else if (mode !== "exponential" && mode !== "multipliers") {
        reader.report(["mode"], "unknown-mode", { mode });
    }

    const base = readBase(recipe.base, reader);
    if (mode === "exponential") {
        const ratio = readRatio(recipe.ratio, reader);
        const steps = readSteps(recipe.steps, reader);
        return base && ratio && steps && { mode, base, ratio, steps };
    }
    if (mode === "multipliers") {
        const multipliers = readMultipliers(recipe.multipliers, reader);
        const names = isJsonObject(recipe.multipliers) ? Object.keys(recipe.multipliers) : [];
        const pairs = readPairs(recipe.pairs, names, reader);
        return base && multipliers && { mode, base, multipliers, ...(pairs && { pairs }) };
    }
    return undefined;
}

function readBase(base: unknown, { report, read }: Reader): ScaleExtension["base"] | undefined {
    if (base === undefined) return report(["base"], "missing-property", { name: "base" });
    if (!isJsonObject(base)) return report(["base"], "not-an-object", { name: "base" });
    const min = read("dimension", base.min, ["base", "min"]);
    const max = read("dimension", base.max, ["base", "max"]);
    return min && max && { min, max };
}

function readRatio(
    ratio: unknown,
    { report, read }: Reader,
): ExponentialScaleConfig["ratio"] | undefined {
    if (ratio === undefined) return report(["ratio"], "missing-property", { name: "ratio" });
    if (!isJsonObject(ratio)) return report(["ratio"], "not-an-object", { name: "ratio" });
    const [min, max] = (["min", "max"] as const).map((end) => {
        const value = read("number", ratio[end], ["ratio", end]);
        if (value !== undefined && value <= 1) {
            report(["ratio", end], "ratio-not-above-one", { ratio: value });
        }
        return value;
    });
    return min !== undefined && max !== undefined ? { min, max } : undefined;
}

function readSteps(
    steps: unknown,
    { report, read }: Reader,
): ExponentialScaleConfig["steps"] | undefined {
    if (steps === undefined) return report(["steps"], "missing-property", { name: "steps" });
    if (!isJsonObject(steps)) return report(["steps"], "not-an-object", { name: "steps" });
    const [negative, positive] = (["negative", "positive"] as const).map((side) => {
        const count = read("number", steps[side], ["steps", side]);
        if (count !== undefined && (!Number.isInteger(count) || count < 0)) {
            report(["steps", side], "not-a-count", { name: `steps.${side}` });
        }
        return count;
    });
    return negative !== undefined && positive !== undefined ? { negative, positive } : undefined;
}

function readMultipliers(
    multipliers: unknown,
    { report, read }: Reader,
): MultiplierScaleConfig["multipliers"] | undefined {
    if (multipliers === undefined) {
        return report(["multipliers"], "missing-property", { name: "multipliers" });
    }
    if (!isJsonObject(multipliers) || Object.keys(multipliers).length === 0) {
        return report(["multipliers"], "no-multipliers");
    }
    const steps = Object.entries(multipliers).map(
        ([name, multiplier]) => [name, read("number", multiplier, ["multipliers", name])] as const,
    );
    const values: MultiplierScaleConfig["multipliers"] = {};
    for (const [name, value] of steps) {
        if (value === undefined) return undefined;
        values[name] = value;
    }
    return values;
}

function readPairs(
    pairs: unknown,
    names: string[],
    { report }: Reader,
): MultiplierScaleConfig["pairs"] | undefined {
    if (pairs === undefined || pairs === "adjacent") return pairs;
    if (!Array.isArray(pairs)) return report(["pairs"], "invalid-pairs");
    return pairs.flatMap((entry, i) => {
        if (typeof entry !== "string" || !entry.includes("-")) {
            report(["pairs", i], "invalid-pair", { entry });
            return [];
        }
        const dash = entry.indexOf("-");
        for (const name of [entry.slice(0, dash), entry.slice(dash + 1)]) {
            if (names.length > 0 && !names.includes(name)) {
                report(["pairs", i], "unknown-multiplier", { name });
            }
        }
        return [entry];
    });
}
