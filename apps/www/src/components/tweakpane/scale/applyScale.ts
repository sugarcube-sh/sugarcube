import { resetCSSVars, setCSSVars } from "../hooks/useCSSVariables";
/**
 * Apply calculated scale values to CSS custom properties at runtime.
 */
import {
    type ExponentialScaleConfig,
    type GeneratedStep,
    type MultiplierScaleConfig,
    calculateExponentialScale,
    calculateMultiplierScale,
} from "./calculator";

/** Default container widths in px (from containers.json) */
const DEFAULT_CONTAINERS: Record<string, number> = {
    xs: 320,
    sm: 384,
    md: 448,
    lg: 512,
    xl: 576,
    "2xl": 672,
    "3xl": 768,
    "4xl": 896,
    "5xl": 1024,
    "6xl": 1152,
    "7xl": 1280,
    "8xl": 1440,
    "9xl": 1600,
};

/** Default base size to calculate scale factor from */
const DEFAULT_BASE = 1; // rem

/**
 * Apply a type scale to --size-step-* CSS vars.
 */
export function applyTypeScale(config: ExponentialScaleConfig): GeneratedStep[] {
    const steps = calculateExponentialScale(config);
    const vars: Record<string, string> = {};

    for (const step of steps) {
        vars[`--size-step-${step.name}`] = step.clamp;
    }

    setCSSVars(vars);
    return steps;
}

/**
 * Apply a space scale to --space-* CSS vars.
 */
export function applySpaceScale(config: MultiplierScaleConfig): GeneratedStep[] {
    const steps = calculateMultiplierScale(config);
    const vars: Record<string, string> = {};

    for (const step of steps) {
        vars[`--space-${step.name}`] = step.clamp;
    }

    setCSSVars(vars);
    return steps;
}

/**
 * Scale container widths proportionally to the base size change.
 */
export function applyContainerScale(baseSize: number): void {
    const scaleFactor = baseSize / DEFAULT_BASE;
    const vars: Record<string, string> = {};

    for (const [name, defaultPx] of Object.entries(DEFAULT_CONTAINERS)) {
        vars[`--container-${name}`] = `${Math.round(defaultPx * scaleFactor)}px`;
    }

    setCSSVars(vars);
}

/**
 * Reset all scale overrides (revert to stylesheet values).
 */
export function resetTypeScale(stepsConfig: { negative: number; positive: number }): void {
    const names: string[] = [];
    for (let i = -stepsConfig.negative; i <= stepsConfig.positive; i++) {
        names.push(`--size-step-${i}`);
    }
    resetCSSVars(names);
}

/**
 * Reset all space scale overrides.
 */
export function resetSpaceScale(multiplierNames: string[], pairs: boolean): void {
    const names = multiplierNames.map((n) => `--space-${n}`);

    if (pairs) {
        for (let i = 0; i < multiplierNames.length - 1; i++) {
            names.push(`--space-${multiplierNames[i]}-${multiplierNames[i + 1]}`);
        }
    }

    resetCSSVars(names);
}

/**
 * Reset container overrides.
 */
export function resetContainerScale(): void {
    resetCSSVars(Object.keys(DEFAULT_CONTAINERS).map((n) => `--container-${n}`));
}
