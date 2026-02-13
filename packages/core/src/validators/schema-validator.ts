import { ErrorMessages } from "../constants/error-messages.js";
import { isReference } from "../guards/token-guards.js";
import type { ArraySchema, ObjectSchema, SimpleSchema, UnionSchema } from "../types/schema.js";
import type { TokenSource } from "../types/tokens.js";
import type { ValidationError } from "../types/validate.js";
import { typeCheckers } from "./schema-utils.js";

export function validateSchema(
    schema: SimpleSchema | ObjectSchema | ArraySchema | UnionSchema,
    value: unknown,
    path: string,
    source: TokenSource
): ValidationError[] {
    if (isReference(value)) {
        return [];
    }

    switch (schema.type) {
        case "object":
            return validateObject(schema, value, path, source);
        case "union":
            return validateUnion(schema, value, path, source);
        case "array":
            return validateArray(schema, value, path, source);
        default:
            return validateSimpleValue(schema, value, path, source);
    }
}

function validateSimpleValue(
    schema: SimpleSchema,
    value: unknown,
    path: string,
    source: TokenSource
): ValidationError[] {
    // Type checking
    const expectedType = schema.type;
    const actualType = typeof value;
    if (expectedType !== actualType) {
        return [
            {
                path,
                message:
                    schema.errorMessage?.(value, path) ||
                    ErrorMessages.VALIDATE.INVALID_TYPE(schema.type, value, path),
                source,
            },
        ];
    }

    return schema.validate?.(value, path, source) ?? [];
}

function validateObject(
    schema: ObjectSchema,
    value: unknown,
    path: string,
    source: TokenSource
): ValidationError[] {
    if (!typeCheckers.isObject(value)) {
        return [
            {
                path,
                message:
                    schema.errorMessage?.(value, path) ||
                    ErrorMessages.VALIDATE.INVALID_TYPE("object", value, path),
                source,
            },
        ];
    }

    const errors: ValidationError[] = [];
    const objValue = value as Record<string, unknown>;

    if (schema.required) {
        for (const requiredProp of schema.required) {
            if (!(requiredProp in objValue)) {
                errors.push({
                    path: `${path}.${requiredProp}`,
                    message: ErrorMessages.VALIDATE.MISSING_REQUIRED_PROPERTY(requiredProp, path),
                    source,
                });
            }
        }
    }

    for (const [key, propSchema] of Object.entries(schema.properties)) {
        if (key in objValue) {
            errors.push(...validateSchema(propSchema, objValue[key], `${path}.${key}`, source));
        }
    }

    return errors;
}

function validateUnion(
    schema: UnionSchema,
    value: unknown,
    path: string,
    source: TokenSource
): ValidationError[] {
    let bestMatchErrors: ValidationError[] = [];
    let bestMatchLength = Number.POSITIVE_INFINITY;

    for (const subSchema of schema.oneOf) {
        if (
            (subSchema.type === "string" && typeof value !== "string") ||
            (subSchema.type === "object" && typeof value !== "object")
        ) {
            continue;
        }

        const errors = validateSchema(subSchema, value, path, source);
        if (errors.length === 0) {
            return subSchema.validate?.(value, path, source) ?? [];
        }
        if (errors.length < bestMatchLength) {
            bestMatchErrors = errors;
            bestMatchLength = errors.length;
        }
    }

    // If no schema was attempted, it's a type error
    if (bestMatchLength === Number.POSITIVE_INFINITY) {
        return [
            {
                path,
                message: ErrorMessages.VALIDATE.INVALID_TYPE(
                    schema.oneOf.map((s) => s.type).join(" or "),
                    value,
                    path
                ),
                source,
            },
        ];
    }

    return bestMatchErrors;
}

function validateArray(
    schema: ArraySchema,
    value: unknown,
    path: string,
    source: TokenSource
): ValidationError[] {
    if (!Array.isArray(value)) {
        return [
            {
                path,
                message:
                    schema.errorMessage?.(value, path) ||
                    ErrorMessages.VALIDATE.INVALID_TYPE("array", value, path),
                source,
            },
        ];
    }

    return schema.validate?.(value, path, source) ?? [];
}
