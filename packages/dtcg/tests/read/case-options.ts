import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import {
    type ExtensionValidator,
    type Generator,
    type ReadOptions,
    type StandardSchemaV1,
    defineExtensionValidator,
    defineGenerator,
} from "../../src/index.js";
import { extensionReader, parseValue } from "../../src/values.js";

export type CaseOptions = Pick<
    ReadOptions,
    "inputs" | "permutations" | "permutationLimit" | "hexStringColors" | "ignoreUnknownProperties"
> & {
    generators?: (keyof typeof generators)[];
    extensionValidators?: (keyof typeof validators)[];
};

function schema<Output>(
    validate: (value: unknown) => StandardSchemaV1.Result<Output>,
): StandardSchemaV1<unknown, Output> {
    return { "~standard": { version: 1, vendor: "test", validate } };
}

const countSchema = schema<{ count: number }>((value) => {
    const count = Number((value as { count?: unknown }).count);
    return Number.isInteger(count)
        ? { value: { count } }
        : { issues: [{ message: "Expected a whole number", path: [{ key: "count" }] }] };
});

const fluidSchema = schema<{ fluid: boolean }>((value) => {
    const { fluid } = value as { fluid?: unknown };
    return typeof fluid === "boolean"
        ? { value: { fluid } }
        : { issues: [{ message: "Expected boolean", path: [{ key: "fluid" }] }] };
});

const generators = {
    steps: defineGenerator({
        extension: ["com.example", "steps"],
        messages: {
            "not-a-count": ({ steps }: { steps: unknown }) =>
                `\`steps\` must be a whole number above 0, not ${JSON.stringify(steps)}`,
        },
        generate: (_group, steps) =>
            typeof steps === "number" && Number.isInteger(steps) && steps > 0
                ? {
                      ok: true,
                      value: Array.from({ length: steps }, (_, i) => ({
                          name: String(steps - i),
                          $value: { value: steps - i, unit: "rem" },
                      })),
                  }
                : { ok: false, errors: [{ path: [], reason: "not-a-count", data: { steps } }] },
    }),
    ramp: defineGenerator({
        extension: ["com.example", "ramp"],
        messages: {
            "count-not-a-number": ({ count }: { count: unknown }) =>
                `\`count\` must be a number, not ${JSON.stringify(count)}`,
        },
        generate: (_group, ramp) => {
            const { count, size, color } = ramp as {
                count?: unknown;
                size?: unknown;
                color?: unknown;
            };
            if (size !== undefined) {
                const parsed = parseValue("dimension", size, ["size"], { references: false });
                if (!parsed.ok) return parsed;
            }
            if (color !== undefined) {
                const parsed = parseValue("color", color, ["color"], { references: false });
                if (!parsed.ok) return parsed;
            }
            return typeof count === "number"
                ? {
                      ok: true,
                      value: Array.from({ length: count }, (_, i) => ({
                          name: String(i + 1),
                          $value: { value: i + 1, unit: "px" },
                      })),
                  }
                : {
                      ok: false,
                      errors: [{ path: ["count"], reason: "count-not-a-number", data: { count } }],
                  };
        },
    }),
    sized: defineGenerator({
        extension: ["com.example", "sized"],
        generate: (_group, extension, options) => {
            const reader = extensionReader<Record<never, never>>(options);
            const size = reader.read("dimension", (extension as { size?: unknown }).size, ["size"]);
            return reader.result(size && [{ name: "1", $value: size }]);
        },
    }),
    counted: defineGenerator({
        extension: ["com.example", "counted"],
        schema: countSchema,
        generate: (_group, { count }) => ({
            ok: true,
            value: Array.from({ length: count }, (_, i) => ({
                name: String(i + 1),
                $value: { value: i + 1, unit: "px" },
            })),
        }),
    }),
} satisfies Record<string, Generator>;

const validators = {
    fluid: defineExtensionValidator({
        key: "com.example",
        appliesTo: ["dimension", "group"],
        schema: fluidSchema,
    }),
    outline: defineExtensionValidator({
        key: "com.example",
        appliesTo: ["color"],
        messages: { "no-outline": () => "`outline` is missing" },
        validate: (_token, extension, options) => {
            const { outline } = extension as { outline?: unknown };
            if (outline === undefined) return [{ path: [], reason: "no-outline" }];
            const parsed = parseValue("dimension", outline, ["outline"], {
                ...options,
                references: false,
            });
            return [...parsed.ignored, ...(parsed.ok ? [] : parsed.errors)];
        },
    }),
    symbolPath: defineExtensionValidator({
        key: "com.example",
        appliesTo: ["number"],
        schema: schema(() => ({
            issues: [{ message: "Not allowed", path: [{ key: "a" }, 0, Symbol("b"), "c"] }],
        })),
    }),
} satisfies Record<string, ExtensionValidator>;

export function readOptions(caseOptions: CaseOptions = {}): ReadOptions {
    const { generators: names, extensionValidators: checks, ...options } = caseOptions;
    return {
        ...options,
        ...(names && { generators: names.map((name) => generators[name]) }),
        ...(checks && { extensionValidators: checks.map((name) => validators[name]) }),
    };
}

export function inputFiles(folder: string): Record<string, string> {
    if (!existsSync(folder)) return {};
    return Object.fromEntries(
        readdirSync(folder, { recursive: true, withFileTypes: true })
            .filter((entry) => entry.isFile())
            .map((entry) => {
                const path = join(entry.parentPath, entry.name);
                return [relative(folder, path).replaceAll("\\", "/"), readFileSync(path, "utf8")];
            }),
    );
}
