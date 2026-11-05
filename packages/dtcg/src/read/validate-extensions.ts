import type { Problems } from "./diagnostics.js";
import type { Node } from "jsonc-parser";
import type {
    ExtensionError,
    ExtensionMessages,
    ExtensionValidator,
    Permutation,
    StandardSchemaV1,
    IgnoredProperty,
    ParseOptions,
    ValueError,
} from "../model.js";
import {
    type CheckedExtension,
    type SchemaOutput,
    Reported,
    checkSchema,
    extensionAt,
    extensionDiagnostic,
} from "./extension-check.js";
import type { JsonFile } from "./json.js";
import { everyGroup } from "./merge.js";
import { settingsOf } from "./settings.js";
import type { NormalisedPermutation } from "./normalise.js";

type Checked = Parameters<NonNullable<ExtensionValidator["validate"]>>[0];

/**
 * Defines an {@link ExtensionValidator}.
 *
 * TypeScript checks that each error `validate` returns has a message in `messages`. With a
 * `schema`, `validate` gets the schema's output.
 *
 * @param validator - The validator, with its `key`, `appliesTo`, `messages` and `validate`.
 *
 * @example
 * // Checks that a dimension's { "fluid": … } is true or false
 * const fluid = defineExtensionValidator({
 *     key: "com.example",
 *     appliesTo: ["dimension"],
 *     messages: {
 *         "not-a-boolean": ({ fluid }: { fluid: unknown }) =>
 *             `\`fluid\` must be true or false, not ${JSON.stringify(fluid)}`,
 *     },
 *     validate: (token, extension) => {
 *         const { fluid } = extension as { fluid?: unknown };
 *         return typeof fluid === "boolean"
 *             ? []
 *             : [{ jsonPath: ["fluid"], reason: "not-a-boolean", data: { fluid } }];
 *     },
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
            options: ParseOptions,
        ) => (ExtensionError<NoInfer<M>> | ValueError | IgnoredProperty)[];
    },
): ExtensionValidator {
    return validator;
}

export function validateExtensions(
    normalised: NormalisedPermutation[],
    permutations: readonly Permutation[],
    {
        validators,
        parseOptions,
    }: { validators: readonly ExtensionValidator[]; parseOptions: ParseOptions },
    diagnostics: Problems,
): void {
    if (validators.length === 0) return;

    normalised.forEach(({ merged, input }, index) => {
        const reported = new Reported();
        const check = (
            validator: ExtensionValidator,
            on: Checked,
            value: unknown,
            json: JsonFile,
            node: Node,
        ) => {
            if (!reported.first(validator, node)) return;
            const passed = checkSchema(validator.schema, value, validator.key);
            const problems = passed.ok
                ? (validator.validate?.(on, passed.value, parseOptions) ?? [])
                : passed.problems;
            const extension: CheckedExtension = {
                within: [validator.key],
                messages: validator.messages,
                json,
                node,
                ...(on.path !== undefined && { path: on.path }),
            };
            for (const each of problems)
                diagnostics.found(extensionDiagnostic(each, extension), input);
        };

        for (const [path, group] of everyGroup(merged)) {
            const settings = settingsOf(merged, group);
            for (const validator of validators) {
                if (!validator.appliesTo.includes("group")) continue;
                const at = settings.extensionsAt?.[validator.key];
                const found = extensionAt(settings.extensions, at, [validator.key]);
                if (!at || !found) continue;
                const on: Checked = { ...(path !== undefined && { path }), type: "group" };
                check(validator, on, found.value, at.json, found.node);
            }
        }

        const types = new Map(permutations[index]?.tokens.map(({ path, type }) => [path, type]));
        for (const token of merged.tokens.values()) {
            const type = types.get(token.path);
            const at = token.extensionsAt;
            if (!type || !at) continue;
            for (const validator of validators) {
                if (!validator.appliesTo.includes(type)) continue;
                const found = extensionAt(token.extensions, at, [validator.key]);
                if (found)
                    check(validator, { path: token.path, type }, found.value, at.json, found.node);
            }
        }
    });
}
