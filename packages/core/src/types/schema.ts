import type { TokenSource, TokenType } from "./tokens.js";
import type { ValidationError } from "./validate.js";

type BaseSchema = {
    validate?: (value: unknown, path: string, source: TokenSource) => ValidationError[];
    errorMessage?: (value: unknown, path: string) => string;
};

export type Schema = SimpleSchema | ObjectSchema | ArraySchema | UnionSchema;

export type SimpleSchema = BaseSchema & {
    type: "string" | "number" | "boolean";
};

export type ArraySchema = BaseSchema & {
    type: "array";
};

export type ObjectSchema = BaseSchema & {
    type: "object";
    properties: Record<string, Schema>;
    required?: string[];
};

export type UnionSchema = BaseSchema & {
    type: "union";
    oneOf: Schema[];
};

export type TokenValidationSchema = {
    tokenType: TokenType;
    schema: Schema;
};
