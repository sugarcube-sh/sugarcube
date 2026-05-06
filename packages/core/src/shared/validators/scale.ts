/**
 * Validates the shape of an `sh.sugarcube.scale` extension config.
 *
 * Scale expansion runs before reference resolution, so any DTCG reference
 * inside the config would never resolve and is rejected at validation
 * time. Other rules cover required fields, mode-specific fields, and
 * exponential ratio bounds.
 */

import type { TokenSource } from "../../types/tokens.js";
import type { ValidationError } from "../../types/validate.js";
import { ErrorMessages } from "../constants/error-messages.js";
import { isReference } from "../guards.js";

export function validateScaleExtension(
    ext: unknown,
    path: string,
    source: TokenSource
): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!isObject(ext)) {
        errors.push({
            path,
            message: ErrorMessages.VALIDATE.INVALID_TYPE("object", ext, path),
            source,
        });
        return errors;
    }

    collectReferenceErrors(ext, path, source, errors);

    const mode = ext.mode;
    if (mode === undefined) {
        errors.push({
            path: `${path}.mode`,
            message: ErrorMessages.VALIDATE.MISSING_REQUIRED_PROPERTY("mode", path),
            source,
        });
    } else if (mode !== "exponential" && mode !== "multipliers") {
        errors.push({
            path: `${path}.mode`,
            message: ErrorMessages.VALIDATE.INVALID_ENUM_VALUE(
                ["exponential", "multipliers"],
                mode,
                `${path}.mode`
            ),
            source,
        });
    }

    validateBase(ext.base, `${path}.base`, source, errors);

    if (mode === "exponential") {
        validateExponentialFields(ext, path, source, errors);
    } else if (mode === "multipliers") {
        validateMultiplierFields(ext, path, source, errors);
    }

    return errors;
}

function validateBase(
    value: unknown,
    path: string,
    source: TokenSource,
    errors: ValidationError[]
): void {
    if (value === undefined) {
        errors.push({
            path,
            message: ErrorMessages.VALIDATE.MISSING_REQUIRED_PROPERTY("base", path),
            source,
        });
        return;
    }

    if (!isObject(value)) {
        errors.push({
            path,
            message: ErrorMessages.VALIDATE.INVALID_TYPE("object", value, path),
            source,
        });
        return;
    }

    validateDimension(value.min, `${path}.min`, source, errors);
    validateDimension(value.max, `${path}.max`, source, errors);
}

function validateDimension(
    value: unknown,
    path: string,
    source: TokenSource,
    errors: ValidationError[]
): void {
    if (!isObject(value)) {
        errors.push({
            path,
            message: ErrorMessages.VALIDATE.INVALID_DIMENSION(value, path),
            source,
        });
        return;
    }

    const numericValue = value.value;
    const unit = value.unit;

    if (typeof numericValue !== "number") {
        errors.push({
            path: `${path}.value`,
            message: ErrorMessages.VALIDATE.INVALID_NUMBER(numericValue, `${path}.value`),
            source,
        });
    }

    if (unit !== "rem" && unit !== "px") {
        errors.push({
            path: `${path}.unit`,
            message: ErrorMessages.VALIDATE.INVALID_DIMENSION_UNIT(unit, `${path}.unit`),
            source,
        });
    }
}

function validateExponentialFields(
    ext: Record<string, unknown>,
    path: string,
    source: TokenSource,
    errors: ValidationError[]
): void {
    const ratio = ext.ratio;
    if (ratio === undefined) {
        errors.push({
            path: `${path}.ratio`,
            message: ErrorMessages.VALIDATE.MISSING_REQUIRED_PROPERTY("ratio", path),
            source,
        });
    } else if (!isObject(ratio)) {
        errors.push({
            path: `${path}.ratio`,
            message: ErrorMessages.VALIDATE.INVALID_TYPE("object", ratio, `${path}.ratio`),
            source,
        });
    } else {
        for (const key of ["min", "max"] as const) {
            const v = ratio[key];
            if (typeof v !== "number") {
                errors.push({
                    path: `${path}.ratio.${key}`,
                    message: ErrorMessages.VALIDATE.INVALID_NUMBER(v, `${path}.ratio.${key}`),
                    source,
                });
            } else if (v <= 1) {
                errors.push({
                    path: `${path}.ratio.${key}`,
                    message: ErrorMessages.VALIDATE.SCALE_INVALID_RATIO(v, `${path}.ratio.${key}`),
                    source,
                });
            }
        }
    }

    const steps = ext.steps;
    if (steps === undefined) {
        errors.push({
            path: `${path}.steps`,
            message: ErrorMessages.VALIDATE.MISSING_REQUIRED_PROPERTY("steps", path),
            source,
        });
    } else if (!isObject(steps)) {
        errors.push({
            path: `${path}.steps`,
            message: ErrorMessages.VALIDATE.INVALID_TYPE("object", steps, `${path}.steps`),
            source,
        });
    } else {
        for (const key of ["negative", "positive"] as const) {
            const v = steps[key];
            if (typeof v !== "number" || !Number.isInteger(v) || v < 0) {
                errors.push({
                    path: `${path}.steps.${key}`,
                    message: ErrorMessages.VALIDATE.INVALID_TYPE(
                        "non-negative integer",
                        v,
                        `${path}.steps.${key}`
                    ),
                    source,
                });
            }
        }
    }
}

function validateMultiplierFields(
    ext: Record<string, unknown>,
    path: string,
    source: TokenSource,
    errors: ValidationError[]
): void {
    const multipliers = ext.multipliers;
    if (multipliers === undefined) {
        errors.push({
            path: `${path}.multipliers`,
            message: ErrorMessages.VALIDATE.MISSING_REQUIRED_PROPERTY("multipliers", path),
            source,
        });
    } else if (!isObject(multipliers) || Object.keys(multipliers).length === 0) {
        errors.push({
            path: `${path}.multipliers`,
            message: ErrorMessages.VALIDATE.SCALE_EMPTY_MULTIPLIERS(`${path}.multipliers`),
            source,
        });
    } else {
        for (const [key, v] of Object.entries(multipliers)) {
            if (typeof v !== "number") {
                errors.push({
                    path: `${path}.multipliers.${key}`,
                    message: ErrorMessages.VALIDATE.INVALID_NUMBER(v, `${path}.multipliers.${key}`),
                    source,
                });
            }
        }
    }

    validatePairs(
        ext.pairs,
        isObject(multipliers) ? Object.keys(multipliers) : [],
        `${path}.pairs`,
        source,
        errors
    );
}

function validatePairs(
    value: unknown,
    multiplierNames: string[],
    path: string,
    source: TokenSource,
    errors: ValidationError[]
): void {
    if (value === undefined) return;
    if (value === "adjacent") return;

    if (!Array.isArray(value)) {
        errors.push({
            path,
            message: ErrorMessages.VALIDATE.SCALE_INVALID_PAIRS(path),
            source,
        });
        return;
    }

    value.forEach((entry, i) => {
        if (typeof entry !== "string" || !entry.includes("-")) {
            errors.push({
                path: `${path}[${i}]`,
                message: ErrorMessages.VALIDATE.SCALE_INVALID_PAIR_ENTRY(entry, `${path}[${i}]`),
                source,
            });
            return;
        }
        const dash = entry.indexOf("-");
        const from = entry.slice(0, dash);
        const to = entry.slice(dash + 1);
        for (const name of [from, to]) {
            if (!multiplierNames.includes(name)) {
                errors.push({
                    path: `${path}[${i}]`,
                    message: ErrorMessages.VALIDATE.SCALE_PAIR_UNKNOWN_MULTIPLIER(
                        name,
                        `${path}[${i}]`
                    ),
                    source,
                });
            }
        }
    });
}

function collectReferenceErrors(
    value: unknown,
    path: string,
    source: TokenSource,
    errors: ValidationError[]
): void {
    if (isReference(value)) {
        errors.push({
            path,
            message: ErrorMessages.VALIDATE.SCALE_CONTAINS_REFERENCE(path),
            source,
        });
        return;
    }

    if (Array.isArray(value)) {
        value.forEach((item, index) => {
            collectReferenceErrors(item, `${path}[${index}]`, source, errors);
        });
        return;
    }

    if (isObject(value)) {
        for (const [key, child] of Object.entries(value)) {
            collectReferenceErrors(child, `${path}.${key}`, source, errors);
        }
    }
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
