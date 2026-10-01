import type { JsonPath, ParseResult, TokenType, ValueByType, ValueError } from "@sugarcube-sh/dtcg";
import { parseValue } from "@sugarcube-sh/dtcg/values";
import type { ScaleExtension } from "../../types/extensions.js";
import { ErrorMessages } from "../constants/error-messages.js";

type Messages = typeof ErrorMessages.SCALE_RECIPE;
type Reason = keyof Messages;
type Facts<R extends Reason> = Parameters<Messages[R]>[0];

interface Reader {
    report: <R extends Reason>(path: JsonPath, reason: R, facts: Facts<R>) => void;
    read: <T extends TokenType>(
        type: T,
        raw: unknown,
        path: JsonPath,
    ) => ValueByType[T] | undefined;
}

export function readScaleRecipe(raw: unknown): ParseResult<ScaleExtension> {
    const errors: ValueError[] = [];
    const reader: Reader = {
        report: (path, reason, facts) => {
            const message = ErrorMessages.SCALE_RECIPE[reason] as (facts: unknown) => string;
            errors.push({ kind: "invalid-value", path, message: message(facts), detail: reason });
        },
        read: (type, value, path) => {
            const result = parseValue(type, value, path, { references: false });
            if (result.ok) return result.value;
            errors.push(...result.errors);
            return undefined;
        },
    };

    if (!isObject(raw)) reader.report([], "not-an-object", { name: "scale" });
    else readRecipe(raw, reader);

    if (errors.length === 0) return { ok: true, value: raw as ScaleExtension };
    return { ok: false, errors };
}

function readRecipe(recipe: Record<string, unknown>, reader: Reader): void {
    const { mode } = recipe;
    if (mode === undefined) reader.report(["mode"], "missing-property", { name: "mode" });
    else if (mode !== "exponential" && mode !== "multipliers") {
        reader.report(["mode"], "unknown-mode", { mode });
    }

    readBase(recipe.base, reader);
    if (mode === "exponential") {
        readRatio(recipe.ratio, reader);
        readSteps(recipe.steps, reader);
    } else if (mode === "multipliers") {
        const usable = readMultipliers(recipe.multipliers, reader);
        readPairs(recipe.pairs, usable ? Object.keys(usable) : undefined, reader);
    }
}

function readBase(base: unknown, { report, read }: Reader): void {
    if (base === undefined) return report(["base"], "missing-property", { name: "base" });
    if (!isObject(base)) return report(["base"], "not-an-object", { name: "base" });
    read("dimension", base.min, ["base", "min"]);
    read("dimension", base.max, ["base", "max"]);
}

function readRatio(ratio: unknown, { report, read }: Reader): void {
    if (ratio === undefined) return report(["ratio"], "missing-property", { name: "ratio" });
    if (!isObject(ratio)) return report(["ratio"], "not-an-object", { name: "ratio" });
    for (const end of ["min", "max"] as const) {
        const value = read("number", ratio[end], ["ratio", end]);
        if (value !== undefined && value <= 1) {
            report(["ratio", end], "ratio-not-above-one", { ratio: value });
        }
    }
}

function readSteps(steps: unknown, { report, read }: Reader): void {
    if (steps === undefined) return report(["steps"], "missing-property", { name: "steps" });
    if (!isObject(steps)) return report(["steps"], "not-an-object", { name: "steps" });
    for (const side of ["negative", "positive"] as const) {
        const count = read("number", steps[side], ["steps", side]);
        if (count !== undefined && (!Number.isInteger(count) || count < 0)) {
            report(["steps", side], "not-a-count", { name: `steps.${side}` });
        }
    }
}

function readMultipliers(
    multipliers: unknown,
    { report, read }: Reader,
): Record<string, unknown> | undefined {
    if (multipliers === undefined) {
        report(["multipliers"], "missing-property", { name: "multipliers" });
        return undefined;
    }
    if (!isObject(multipliers) || Object.keys(multipliers).length === 0) {
        report(["multipliers"], "no-multipliers", undefined);
        return undefined;
    }
    for (const [name, multiplier] of Object.entries(multipliers)) {
        read("number", multiplier, ["multipliers", name]);
    }
    return multipliers;
}

function readPairs(pairs: unknown, names: string[] | undefined, { report }: Reader): void {
    if (pairs === undefined || pairs === "adjacent") return;
    if (!Array.isArray(pairs)) return report(["pairs"], "invalid-pairs", undefined);
    pairs.forEach((entry, i) => {
        if (typeof entry !== "string" || !entry.includes("-")) {
            return report(["pairs", i], "invalid-pair", { entry });
        }
        if (!names) return;
        const dash = entry.indexOf("-");
        for (const name of [entry.slice(0, dash), entry.slice(dash + 1)]) {
            if (!names.includes(name)) report(["pairs", i], "unknown-multiplier", { name });
        }
    });
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
