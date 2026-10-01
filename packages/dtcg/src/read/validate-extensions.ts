import type { Node } from "jsonc-parser";
import type {
    Diagnostic,
    ExtensionError,
    ExtensionMessages,
    ExtensionValidator,
    Permutation,
    StandardSchemaV1,
    ValueError,
} from "../index.js";
import { type SchemaOutput, checkSchema, extensionDiagnostic } from "./extension-check.js";
import { type JsonFile, member } from "./json.js";
import type { NormalisedPermutation } from "./normalise.js";

type Checked = Parameters<NonNullable<ExtensionValidator["validate"]>>[0];

/**
 * Defines an {@link ExtensionValidator}, checking each error `validate` returns against its
 * `messages`. With a `schema`, `validate` receives the schema's output.
 *
 * @example
 * // { "space": { "$type": "dimension", "$value": …, "$extensions": { "com.example": { "fluid": true } } } }
 * const fluid = defineExtensionValidator({
 *   key: "com.example",
 *   appliesTo: ["dimension"],
 *   messages: {
 *     "not-a-boolean": ({ fluid }: { fluid: unknown }) =>
 *       `\`fluid\` must be true or false, not ${JSON.stringify(fluid)}`,
 *   },
 *   validate: (token, extension) => {
 *     const { fluid } = extension as { fluid?: unknown };
 *     return typeof fluid === "boolean"
 *       ? []
 *       : [{ path: ["fluid"], reason: "not-a-boolean", data: { fluid } }];
 *   },
 * });
 */
export function defineExtensionValidator<
    const M extends ExtensionMessages = Record<never, never>,
    S extends StandardSchemaV1 | undefined = undefined,
>(
    validator: Omit<ExtensionValidator, "schema" | "messages" | "validate"> & {
        schema?: S;
        messages?: M;
        validate?: (
            on: Checked,
            extension: SchemaOutput<S>,
        ) => (ExtensionError<NoInfer<M>> | ValueError)[];
    },
): ExtensionValidator {
    return validator;
}

export function validateExtensions(
    normalised: NormalisedPermutation[],
    permutations: Permutation[],
    validators: ExtensionValidator[],
    diagnostics: Diagnostic[],
): void {
    if (validators.length === 0) return;

    normalised.forEach(({ merged }, permutation) => {
        const checked = new Map<ExtensionValidator, Set<Node>>();
        const check = (
            validator: ExtensionValidator,
            on: Checked,
            value: unknown,
            json: JsonFile,
            node: Node,
        ) => {
            const done = checked.get(validator) ?? new Set<Node>();
            checked.set(validator, done);
            if (done.has(node)) return;
            done.add(node);
            const passed = checkSchema(validator.schema, value, validator.key);
            const problems = passed.ok
                ? (validator.validate?.(on, passed.value) ?? [])
                : passed.problems;
            const place = {
                within: [validator.key] as [string],
                messages: validator.messages,
                json,
                node,
                path: on.path,
                permutation,
            };
            for (const problem of problems) {
                diagnostics.push(extensionDiagnostic(problem, place));
            }
        };

        for (const group of [merged.root, ...merged.groups.values()]) {
            for (const validator of validators) {
                const at = group.extensionsAt?.[validator.key];
                if (!at || !validator.appliesTo.includes("group")) continue;
                const node = member(at.node, validator.key, at.json.hidden);
                if (!node) continue;
                const value = group.extensions?.[validator.key];
                check(validator, { path: group.path, type: "group" }, value, at.json, node);
            }
        }

        const types = new Map(
            permutations[permutation]?.tokens.map(({ path, type }) => [path, type]),
        );
        for (const token of merged.tokens.values()) {
            const type = types.get(token.path);
            const object = token.value.parent?.parent;
            if (token.added || !type || !object || !token.extensions) continue;
            const extensions = member(object, "$extensions", token.json.hidden);
            if (!extensions) continue;
            for (const validator of validators) {
                const node = member(extensions, validator.key, token.json.hidden);
                if (!node || !validator.appliesTo.includes(type)) continue;
                const value = token.extensions[validator.key];
                check(validator, { path: token.path, type }, value, token.json, node);
            }
        }
    });
}
