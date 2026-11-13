import type { StandardSchemaV1 } from "../standard-schema.js";
import type { JsonValue } from "./json.js";
import type { JsonPath } from "./location.js";
import type { IgnoredProperty, ParseOptions, ValueError } from "./parse.js";
import type { TokenType } from "./value.js";

/**
 * Checks your own `$extensions` key.
 *
 * Give it a Standard Schema, such as from Zod, or a `validate` function with `messages`. With both,
 * `validate` only sees what passes the schema. Each problem is reported as `extension-invalid`.
 *
 * @example
 * // fluid must be true or false
 * const fluid = defineExtensionValidator({
 *     key: "com.example",
 *     appliesTo: ["dimension"],
 *     schema: z.object({ fluid: z.boolean() }),
 * });
 */
export interface ExtensionValidator {
    /** The vendor namespace, such as `"com.example"`. */
    key: string;
    /** The token types it checks, and `"group"` for groups. */
    appliesTo: readonly (TokenType | "group")[];
    /** A schema the extension must pass. It must validate synchronously. */
    schema?: StandardSchemaV1;
    /** The wording for each reason `validate` returns. */
    messages?: ExtensionMessages;
    /**
     * Returns why the extension isn't valid, or `[]`.
     *
     * An error's `jsonPath` starts at the extension. With `createExtensionReader`, return the
     * reader's `result` as it is.
     *
     * @param owner - The token or group, by its path and type.
     * @param extension - Your extension's data, or the schema's output if there's a `schema`.
     * @param options - How the read reads values. Pass them to `createExtensionReader` or
     * `parseValue` to read values the same way.
     */
    validate?(
        owner: {
            /** Where it is, such as `"color.brand"`; `""` for the top level of a file. */
            path: string;
            /** The token's type, or `"group"`. */
            type: TokenType | "group";
        },
        extension: unknown,
        options: ParseOptions,
    ): (ExtensionError | ValueError | IgnoredProperty)[] | ExtensionResult<unknown>;
}

/** A token a generator makes, as a file would write it. */
export interface GeneratedToken {
    /**
     * Its name in the group, such as `"md"`.
     *
     * A name the spec doesn't allow, such as one with a `.`, is reported as `invalid-name`. It
     * makes no token.
     */
    name: string;
    /** @default the group's type */
    $type?: TokenType;
    /** The value as a file would write it, such as `{ value: 1, unit: "rem" }`. */
    $value: JsonValue;
    $description?: string;
    $extensions?: Record<string, JsonValue>;
}

/**
 * Your extension's messages, one for each reason.
 *
 * Each takes the reason's facts and returns the message. To add how to fix it, return
 * `{ message, help }`. Write them as dtcg does. Start lowercase, and leave off the full stop and
 * the place.
 *
 * @example
 * // Two reasons
 * {
 *     "ratio-not-above-one": ({ ratio }: { ratio: number }) =>
 *         `a ratio of ${ratio} makes a flat or shrinking scale`,
 *     "no-multipliers": () => "`multipliers` must name at least one step",
 * }

 */
export type ExtensionMessages = Record<
    string,
    (data: any) => string | { readonly message: string; readonly help?: string }
>;

/**
 * A problem with your extension, by its reason.
 *
 * dtcg words it from your {@link ExtensionMessages}.
 *
 * @example
 * // A ratio that's too small
 * { jsonPath: ["ratio"], reason: "ratio-not-above-one", data: { ratio: 1 } }
 */
export type ExtensionError<M extends ExtensionMessages = ExtensionMessages> = string extends keyof M
    ? {
          /** Where in the extension, such as `["ratio", "min"]`. */
          jsonPath: JsonPath;
          reason: string;
          data?: unknown;
      }
    : {
          [R in keyof M & string]: {
              /** Where in the extension, such as `["ratio", "min"]`. */
              jsonPath: JsonPath;
              reason: R;
          } & (Parameters<M[R]> extends [] ? { data?: undefined } : { data: Parameters<M[R]>[0] });
      }[keyof M & string];

/**
 * The value read from an extension, or every problem found.
 *
 * `ignored` lists the properties set aside, either way. Return it from `generate` or `validate`.
 *
 * @example
 * // A fluid range with no max
 * reader.result(undefined)
 * // => { ok: false, errors: [{ jsonPath: ["max"], reason: "missing-property", data: { name: "max" } }] }
 */
export type ExtensionResult<V, M extends ExtensionMessages = ExtensionMessages> =
    | { ok: true; value: V; ignored?: IgnoredProperty[] }
    | { ok: false; errors: (ExtensionError<M> | ValueError)[]; ignored?: IgnoredProperty[] };

/**
 * Makes tokens from an extension on a group, such as the steps of a spacing scale.
 *
 * Each token it makes is marked {@link TokenBase.generated | generated}. If a file writes one too,
 * the generated token is used, and the file's is a `overridden-by-generator` error.
 */
export interface Generator {
    /**
     * Where the extension is in a group's `$extensions`, such as `["com.example", "steps"]`.
     *
     * A group without it is left alone.
     */
    extension: readonly [string, ...string[]];
    /**
     * A schema the extension must pass before `generate` sees it.
     *
     * It must validate synchronously. If it fails, `generate` isn't called.
     */
    schema?: StandardSchemaV1;
    /** The wording for each reason `generate` returns. */
    messages?: ExtensionMessages;
    /**
     * Returns the tokens an extension makes, or why it isn't valid.
     *
     * An error's `jsonPath` starts at the extension. If it isn't valid, the group gets no tokens.
     *
     * @param group - The group, by its path and type.
     * @param extension - Your extension's data, or the schema's output if there's a `schema`.
     * @param options - How the read reads values. Pass them to `createExtensionReader` or
     * `parseValue` to read values the same way.
     */
    generate(
        group: {
            /** Where it is, such as `"color.brand"`; `""` for the top level of a file. */
            path: string;
            /**
             * The type its tokens take, as {@link Group.type} gives it. It's absent if there's
             * none.
             */
            type?: TokenType;
        },
        extension: unknown,
        options: ParseOptions,
    ): ExtensionResult<GeneratedToken[]>;
}
