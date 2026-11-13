import type { DiagnosticCollector } from "../diagnostics/diagnostics.js";
import type { Node } from "jsonc-parser";
import type {
    ExtensionError,
    ExtensionMessages,
    ExtensionResult,
    ExtensionValidator,
} from "../../model/extension.js";
import type { Permutation, Input } from "../../model/permutation.js";
import type { StandardSchemaV1 } from "../../standard-schema.js";
import type { IgnoredProperty, ParseOptions, ValueError } from "../../model/parse.js";
import {
    type CheckedExtension,
    type SchemaOutput,
    ReportDeduper,
    checkSchema,
    findExtension,
    extensionDiagnostic,
} from "./check.js";
import type { JsonFile } from "../json/parse.js";
import { findSettings } from "../merge/settings.js";
import type { Merged } from "../merge/merge.js";
import type { NormalisedPermutation } from "../merge/normalise.js";

type ExtensionOwner = Parameters<NonNullable<ExtensionValidator["validate"]>>[0];

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
            owner: ExtensionOwner,
            extension: SchemaOutput<S>,
            options: ParseOptions,
        ) =>
            | (ExtensionError<NoInfer<M>> | ValueError | IgnoredProperty)[]
            | ExtensionResult<unknown, NoInfer<M>>;
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
    diagnostics: DiagnosticCollector,
): void {
    if (validators.length === 0) return;

    normalised.forEach(({ merged, input }, index) => {
        const validation = new ExtensionValidation(validators, parseOptions, diagnostics, input);
        validation.validateGroups(merged);
        validation.validateTokens(merged, permutations[index]);
    });
}

class ExtensionValidation {
    readonly #validators: readonly ExtensionValidator[];
    readonly #parseOptions: ParseOptions;
    readonly #diagnostics: DiagnosticCollector;
    readonly #input: Input;
    readonly #reported = new ReportDeduper();

    constructor(
        validators: readonly ExtensionValidator[],
        parseOptions: ParseOptions,
        diagnostics: DiagnosticCollector,
        input: Input,
    ) {
        this.#validators = validators;
        this.#parseOptions = parseOptions;
        this.#diagnostics = diagnostics;
        this.#input = input;
    }

    validateGroups(merged: Merged): void {
        for (const [path, group] of merged.groups) {
            const settings = findSettings(merged, group);
            for (const validator of this.#validators) {
                if (!validator.appliesTo.includes("group")) continue;
                const location = settings.extensionLocations?.[validator.key];
                const found = findExtension(settings.extensions, location, [validator.key]);
                if (!location || !found) continue;

                const owner: ExtensionOwner = { path, type: "group" };
                this.#check(validator, owner, found.value, location.json, found.node);
            }
        }
    }

    validateTokens(merged: Merged, permutation: Permutation | undefined): void {
        const types = new Map(permutation?.tokens.map(({ path, type }) => [path, type]));
        for (const token of merged.tokens.values()) {
            const type = types.get(token.path);
            const location = token.extensionsLocation;
            if (!type || !location) continue;

            for (const validator of this.#validators) {
                if (!validator.appliesTo.includes(type)) continue;
                const found = findExtension(token.extensions, location, [validator.key]);
                if (!found) continue;

                const owner = { path: token.path, type };
                this.#check(validator, owner, found.value, location.json, found.node);
            }
        }
    }

    #check(
        validator: ExtensionValidator,
        owner: ExtensionOwner,
        value: unknown,
        json: JsonFile,
        node: Node,
    ): void {
        if (!this.#reported.isFirst(validator, node)) return;

        const passed = checkSchema(validator.schema, value, validator.key);
        const problems = passed.ok
            ? toProblems(validator.validate?.(owner, passed.value, this.#parseOptions) ?? [])
            : passed.problems;
        const extension: CheckedExtension = {
            keyPath: [validator.key],
            messages: validator.messages,
            json,
            node,
            path: owner.path,
        };
        for (const each of problems) {
            this.#diagnostics.add(extensionDiagnostic(each, extension), this.#input);
        }
    }
}

function toProblems(
    returned: NonNullable<ReturnType<NonNullable<ExtensionValidator["validate"]>>>,
): (ExtensionError | ValueError | IgnoredProperty)[] {
    if (Array.isArray(returned)) return returned;
    return [...(returned.ignored ?? []), ...(returned.ok ? [] : returned.errors)];
}
