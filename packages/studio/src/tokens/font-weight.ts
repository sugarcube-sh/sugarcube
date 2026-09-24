import { FONT_WEIGHT_ALIASES } from "@sugarcube-sh/core/client";

export type FontWeightShape = "number" | "keyword";

export type FontWeightValue = {
    weight: number;
    shape: FontWeightShape;
};

export type FontWeightOption = {
    value: string;
    label: string;
    detail: string;
};

export const FONT_WEIGHT_STEPS = [
    { weight: 100, keyword: "thin", label: "Thin" },
    { weight: 200, keyword: "extra-light", label: "Extra light" },
    { weight: 300, keyword: "light", label: "Light" },
    { weight: 400, keyword: "normal", label: "Normal" },
    { weight: 500, keyword: "medium", label: "Medium" },
    { weight: 600, keyword: "semi-bold", label: "Semi bold" },
    { weight: 700, keyword: "bold", label: "Bold" },
    { weight: 800, keyword: "extra-bold", label: "Extra bold" },
    { weight: 900, keyword: "black", label: "Black" },
    { weight: 950, keyword: "extra-black", label: "Extra black" },
] as const;

export function readFontWeight(value: unknown): FontWeightValue | undefined {
    if (typeof value === "number") {
        return Number.isFinite(value) ? { weight: value, shape: "number" } : undefined;
    }

    if (typeof value !== "string") return undefined;

    const keyword = value.toLowerCase();
    if (!Object.hasOwn(FONT_WEIGHT_ALIASES, keyword)) return undefined;
    return { weight: FONT_WEIGHT_ALIASES[keyword] as number, shape: "keyword" };
}

export function writeFontWeight(shape: FontWeightShape, weight: number): number | string {
    if (shape === "number") return weight;
    return FONT_WEIGHT_STEPS.find((step) => step.weight === weight)?.keyword ?? weight;
}

export function fontWeightOptions(current: number | undefined): FontWeightOption[] {
    const options: FontWeightOption[] = FONT_WEIGHT_STEPS.map((step) => ({
        value: String(step.weight),
        label: step.label,
        detail: String(step.weight),
    }));

    if (current === undefined || FONT_WEIGHT_STEPS.some((step) => step.weight === current)) {
        return options;
    }

    options.push({ value: String(current), label: String(current), detail: String(current) });
    return options.sort((a, b) => Number(a.value) - Number(b.value));
}
