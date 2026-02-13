import { ErrorMessages } from "../constants/error-messages.js";
import type { ObjectSchema, TokenValidationSchema } from "../types/schema.js";
import type { LineCap, StrokeStyleKeyword, TokenSource } from "../types/tokens.js";
import type { ValidationError } from "../types/validate.js";
import { DimensionSchema } from "./dimension.js";
import { validateSchema } from "./schema-validator.js";

const validKeywords: StrokeStyleKeyword[] = [
    "solid",
    "dashed",
    "dotted",
    "double",
    "groove",
    "ridge",
    "outset",
    "inset",
];

const validLineCaps: LineCap[] = ["round", "butt", "square"];

const CustomStrokeSchema: ObjectSchema = {
    type: "object",
    errorMessage: (value, path) => ErrorMessages.VALIDATE.INVALID_STROKE_STYLE(value, path),
    properties: {
        dashArray: {
            type: "array",
            validate: (value, path, source) => {
                const array = value as unknown[];
                const errors: ValidationError[] = [];

                array.forEach((item, index) => {
                    if (typeof item !== "string") {
                        errors.push(
                            ...validateSchema(
                                DimensionSchema.schema,
                                item,
                                `${path}.${index}`,
                                source
                            )
                        );
                    }
                });
                return errors;
            },
        },
        lineCap: {
            type: "string",
            validate: (value, path, source) => {
                if (!validLineCaps.includes(value as (typeof validLineCaps)[number])) {
                    return [
                        {
                            path,
                            message: ErrorMessages.VALIDATE.INVALID_STROKE_LINE_CAP(value, path),
                            source,
                        },
                    ];
                }
                return [];
            },
        },
    },
    required: ["dashArray", "lineCap"],
};

export const StrokeStyleSchema: TokenValidationSchema = {
    tokenType: "strokeStyle",
    schema: {
        type: "union",
        oneOf: [
            {
                type: "string",
                validate: (value, path, source) => {
                    if (!validKeywords.includes(value as (typeof validKeywords)[number])) {
                        if (typeof value === "string") {
                            return [
                                {
                                    path,
                                    message: ErrorMessages.VALIDATE.INVALID_STROKE_STYLE(
                                        value,
                                        path
                                    ),
                                    source,
                                },
                            ];
                        }
                    }
                    return [];
                },
            },
            CustomStrokeSchema,
        ],
    },
};

export function validateStrokeStyle(
    value: unknown,
    path: string,
    source: TokenSource
): ValidationError[] {
    return validateSchema(StrokeStyleSchema.schema, value, path, source);
}
