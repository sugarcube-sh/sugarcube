import type { ValueErrorDetail, ValueErrorDetailByCode } from "../values/value-errors.js";
import type { InputProblem } from "./errors.js";
import type { JsonPath, Span } from "./location.js";
import type { Permutations } from "./permutations.js";
import type { TokenType } from "./value.js";

/**
 * The facts behind each kind of diagnostic's message.
 *
 * Use them to word a diagnostic yourself, instead of parsing its `message`.
 */
export interface DiagnosticDetailByKind {
    /** A file isn't there, such as a `$ref` to `"gone.json"`. */
    "file-not-found": {
        readonly file: string;
        /** The file that names it, such as the resolver. Absent for the entry file. */
        readonly referencedFrom?: string;
    };
    /**
     * A file isn't valid JSON, or its top level isn't an object.
     *
     * A resolver may have comments, but a token file may not.
     */
    "invalid-json": { readonly reason: JsonErrorReason };
    /**
     * A key is written twice in one object, such as two `$value`s.
     *
     * A warning. The last one is used.
     */
    "duplicate-key": { readonly key: string };
    /**
     * The resolver breaks a rule of the resolver spec, such as a `version` other than `"2025.10"`.
     */
    "resolver-invalid": ResolverProblem;
    /**
     * An input in {@link ReadOptions.inputs} doesn't match the resolver.
     *
     * It has no `span`. Its `relatedInformation` points at the modifier in the resolver.
     */
    "input-invalid": {
        /** Which input, by its index in {@link ReadOptions.inputs}. */
        readonly input: number;
    } & InputProblem;
    /**
     * A name the spec doesn't allow, such as `"a.b"`, or an empty one.
     *
     * @see {@link https://www.designtokens.org/TR/2025.10/format/#character-restrictions | Format 5.1.1, Character restrictions}
     */
    "invalid-name": {
        readonly name: string;
        /** The character the spec forbids there, such as `"."`. It's absent for an empty name. */
        readonly character?: "." | "{" | "}" | "$";
    };
    /**
     * Something is both a token and a group.
     *
     * `reason: "child"` means a token also has `child` inside it.
     * `reason: "declared"` means one file writes a token where another writes a group. `declaredAs`
     * says which this one is.
     * `reason: "ref"` means a `$ref` makes an object a token, but it also has tokens or groups, as
     * if it extended a group, which is `$extends`'s job.
     */
    "token-and-group":
        | {
              readonly reason: "child";
              readonly child: string;
              /** The kind of JSON in `child`, such as `"number"` for `"alpha": 0`. */
              readonly found: "string" | "number" | "boolean" | "null" | "array" | "object";
          }
        | {
              readonly reason: "declared";
              readonly declaredAs: "token" | "group";
              /** The token or group, such as `"color.blue"`. */
              readonly path: string;
              /** The files that write it the other way, such as `["base.json"]`. */
              readonly otherFiles: readonly string[];
          }
        | { readonly reason: "ref"; readonly ref: string };
    /** Something in a group isn't an object, such as `"x": "red"`. */
    "invalid-member": {
        readonly name: string;
        readonly found: "string" | "number" | "boolean" | "null" | "array";
    };
    /** A spec property has the wrong kind of JSON, such as `"$description": 5`. */
    "invalid-property": {
        readonly property:
            | "$type"
            | "$description"
            | "$deprecated"
            | "$extensions"
            | "$extends"
            | "$ref";
        /**
         * The kind of JSON it needs.
         *
         * `"reference"` means a reference such as `"{base}"` or `{ "$ref": "#/base" }`.
         */
        readonly expected: "string" | "object" | "boolean-or-string" | "reference";
        /** For `"$extends": "base"`, the reference it should be, `"{base}"`. */
        readonly reference?: string;
    };
    /** A token has no type, and none can be worked out from its group or its reference. */
    "missing-type": Record<string, never>;
    /**
     * A `$type` the spec doesn't define, such as `"colour"`.
     *
     * @see {@link https://www.designtokens.org/TR/2025.10/format/#types | Format 8, Types}
     */
    "unknown-type": {
        readonly type: string;
        /** A type with a similar name, such as `"color"`, if exactly one is close. */
        readonly suggestion?: TokenType;
    };
    /** A value doesn't fit its type, such as a dimension in `em`. */
    "invalid-value": {
        /** Where in the token, such as `["$value", "unit"]`. */
        readonly jsonPath: JsonPath;
    } & ValueErrorDetail;
    /**
     * A color written as a hex string, such as `"#ff0000"`.
     *
     * The Color module needs a color object.
     */
    "hex-string-color": ValueErrorDetailByCode["hex-string"];
    /** An `$extensions` entry fails a check, such as a {@link Generator}'s. */
    "extension-invalid": {
        /** The `$extensions` key, such as `"com.example"`. */
        readonly key: string;
        /** Where in the token or group, such as `["$extensions", "com.example", "steps"]`. */
        readonly jsonPath: JsonPath;
        /** Why, as the check names it. It's absent for a Standard Schema's problems. */
        readonly reason?: string;
        /** The facts the check's message is worded from. */
        readonly data?: unknown;
    };
    /**
     * A file writes a token that a {@link Generator} also makes, such as `space.1`.
     *
     * The generated token is used, and what the file writes is not.
     */
    "overridden-by-generator": {
        /** The token's path, such as `"space.1"`. */
        readonly path: string;
        /**
         * The group the token is made in, such as `"space"`, or `""` at the top of a file.
         *
         * It can be a group that extends the one with the extension.
         */
        readonly from: string;
        /** The generator's extension, such as `["com.example", "steps"]`. */
        readonly extension: readonly [string, ...string[]];
        /** What the file writes with that name. */
        readonly declaredAs: "token" | "group";
    };
    /** A reference names nothing, such as `{color.primry}`. */
    "missing-reference": {
        /** The reference as written, without braces, such as `"color.primry"`, or a pointer. */
        readonly ref: string;
        /** The path of each token or group that writes the reference. */
        readonly from: readonly string[];
        /**
         * A path close to `ref`, such as `"color.primary"`, if exactly one is close.
         *
         * For a JSON Pointer, it's a pointer. It's absent when the pointer's token exists, but a
         * step inside its value is wrong.
         */
        readonly suggestion?: string;
    };
    /**
     * `$extends` names a token, such as `"$extends": "{base}"` when `base` is a token.
     *
     * @see {@link https://www.designtokens.org/TR/2025.10/format/#error-conditions | Format 6.4.6, Error Conditions}
     */
    "not-a-group": { readonly ref: string };
    /**
     * A `$ref` isn't a valid JSON Pointer, such as `"#color/x/$value"`.
     *
     * It must start `#/`, and a `~` must be `~0` or `~1`.
     *
     * @see {@link https://www.rfc-editor.org/rfc/rfc6901 | RFC 6901, JSON Pointer}
     */
    "malformed-pointer": {
        readonly ref: string;
        readonly reason: "no-leading-slash" | "bad-escape";
        /**
         * The pointer written correctly, such as `"#/color/x/$value"`.
         *
         * It's there when the corrected pointer finds something, and always for a pointer into
         * another file.
         */
        readonly suggestion?: string;
    };
    /**
     * A reference names a group, such as `{color.blue}`.
     *
     * @see {@link https://www.designtokens.org/TR/2025.10/format/#curly-brace-syntax-token-references | Format 7.1.1, Curly brace syntax}
     */
    "not-a-token": { readonly ref: string };
    /**
     * A `$ref` stops at a token instead of reaching into its value, such as `"#/base"`.
     *
     * @see {@link https://www.designtokens.org/TR/2025.10/format/#json-pointer-syntax-required-support | Format 7.1.2, JSON Pointer syntax}
     */
    "not-a-value": {
        readonly ref: string;
        /** The pointer into the token's value, such as `"#/base/$value"`. */
        readonly suggestion: string;
    };
    /**
     * A token has both `$ref` and `$value`.
     *
     * A `$ref` stands in for `$value`, so a token has one or the other. Its `$value` is read.
     *
     * @see {@link https://www.designtokens.org/TR/2025.10/format/#json-pointer-syntax-required-support | Format 7.1.2, JSON Pointer syntax}
     */
    "ref-and-value": Record<string, never>;
    /**
     * A reference in a shadow or gradient array names a token with several layers or stops.
     *
     * There, a reference stands for one layer or stop.
     *
     * @see {@link https://www.designtokens.org/TR/2025.10/format/#array-aliasing-in-composite-types | Format 9.1, Array aliasing in composite types}
     */
    "reference-to-several": {
        readonly ref: string;
        /** How many layers or stops the token has. */
        readonly count: number;
    };
    /**
     * References that loop back, such as `a` to `b` to `a`.
     *
     * @see {@link https://www.designtokens.org/TR/2025.10/format/#circular-references | Format 7.2.3, Circular References}
     */
    "circular-reference": {
        /**
         * The paths around the loop, such as `["a", "b", "a"]`. A reference to the whole file
         * ends it at the top level, `""`.
         */
        readonly chain: readonly string[];
    };
    /** A reference names a token of the wrong type, such as a number where a color is needed. */
    "type-mismatch": {
        readonly ref: string;
        readonly expected: TokenType;
        readonly found: TokenType;
    };
    /**
     * A name starts or ends with a space, such as `"a "`.
     *
     * It's allowed, but usually a typo.
     */
    "whitespace-in-name": { readonly name: string };
    /**
     * A property the spec doesn't define, such as `$foo` on a token.
     *
     * It's an error, except where it's set aside with a warning: a `$` property such as
     * `$metadata` on the group a token file starts with, which design tools write there, and a
     * property in a value, such as `paragraphSpacing` in a typography value, with
     * `ignoreUnknownProperties` on. Without that option, a property in a value is an
     * `invalid-value`.
     */
    "unknown-property":
        | {
              readonly property: string;
              readonly owner: "resolver" | "set" | "modifier" | "token" | "group";
              /**
               * A property with a similar name, such as `"sets"` for `"sest"`, if exactly one is
               * close.
               */
              readonly suggestion?: string;
              /** Present when the property is set aside, so the tokens are read without it. */
              readonly ignored?: true;
          }
        | {
              readonly property: string;
              /** The type of the value it's in. For part of a composite, that's the part's type. */
              readonly type: TokenType;
              /** Where in the token, such as `["$value", "paragraphSpacing"]`. */
              readonly jsonPath: JsonPath;
          };
    /**
     * A spec property written another way, such as `value` or `$Value` for `$value`.
     *
     * It's read as that property, so nothing else fails because of it.
     */
    "misspelt-property": {
        readonly key: string;
        readonly property: "$value" | "$type" | "$description" | "$deprecated" | "$extensions";
        readonly owner: "token" | "group";
    };
    /** A reference names a token marked `$deprecated`. */
    "deprecated-reference": { readonly ref: string; readonly reason?: string };
    /**
     * A resolver has more combinations than `permutationLimit`.
     *
     * Then each context is built on its own instead, as with `"each-context"`.
     */
    "permutation-limit": {
        /** How many combinations the resolver's modifiers make. */
        readonly count: number;
        /** The `permutationLimit`, such as `32`. */
        readonly limit: number;
        /** How many were built instead. */
        readonly built: number;
    };
    /**
     * A set or modifier that `resolutionOrder` never uses.
     *
     * It's a hint, tagged `unnecessary` so an editor can fade it.
     */
    "not-in-resolution-order": {
        readonly item: "set" | "modifier";
        readonly name: string;
    };
}

/**
 * Why a file isn't valid JSON, such as `"comma-expected"`.
 */
export type JsonErrorReason =
    | "comment"
    | "trailing-comma"
    | "not-an-object"
    | "invalid-symbol"
    | "invalid-number-format"
    | "property-name-expected"
    | "value-expected"
    | "colon-expected"
    | "comma-expected"
    | "close-brace-expected"
    | "close-bracket-expected"
    | "end-of-file-expected"
    | "unexpected-end-of-comment"
    | "unexpected-end-of-string"
    | "unexpected-end-of-number"
    | "invalid-unicode"
    | "invalid-escape-character"
    | "invalid-character";

/** A rule of the resolver spec, such as `"version"`. */
export type ResolverRule =
    | "version"
    | "missing-property"
    | "wrong-type"
    | "unknown-set"
    | "unknown-modifier"
    | "invalid-pointer"
    | "circular-reference"
    | "resolver-as-source"
    | "duplicate-name"
    | "unknown-item-type"
    | "no-contexts"
    | "single-context"
    | "empty-resolution-order"
    | "invalid-default"
    | "file-in-resolution-order";

/**
 * The rule a resolver breaks, and where.
 *
 * Check `rule`, and TypeScript knows the rest.
 *
 * @example
 * // A version that isn't "2025.10"
 * diagnostic.detail
 * // => { rule: "version", name: "version", jsonPath: ["version"] }
 */
export type ResolverProblem =
    | {
          readonly rule: Exclude<ResolverRule, "wrong-type">;
          /** The property, set, modifier, pointer or file it's about. */
          readonly name: string;
          /** Where in the resolver, such as `["sets", "base", "sources"]`. */
          readonly jsonPath: JsonPath;
      }
    | {
          readonly rule: "wrong-type";
          readonly name: string;
          readonly jsonPath: JsonPath;
          /** The JSON type the property must be. */
          readonly expected: "string" | "object" | "array";
      };

/**
 * The name of a kind of diagnostic, such as `"missing-reference"`.
 *
 * Check this in your code, not the message. Each kind has a page at {@link Diagnostic.docsUrl}.
 */
export type DiagnosticKind = keyof DiagnosticDetailByKind;

/**
 * A problem with the files, or a note about them.
 *
 * Reading carries on past a problem, so one read reports them all. Check `kind`, and TypeScript
 * knows its `detail`. To fix one, see `@sugarcube-sh/dtcg-edit`.
 *
 * @example
 * // A typo in a reference
 * if (diagnostic.kind === "missing-reference") diagnostic.detail.similar;
 * // => "color.primary"
 */
export type Diagnostic = DiagnosticOf<DiagnosticDetailByKind> & {
    readonly permutations: Permutations;
};

/**
 * A diagnostic with your own kinds.
 *
 * It has the same shape as {@link Diagnostic}, so your checks can be listed with dtcg's. Pass a map
 * from each kind to its facts. Pick kinds dtcg doesn't use.
 *
 * @example
 * // A config check, listed with the read's diagnostics
 * type ConfigDiagnostic = DiagnosticOf<{ "selector-empty": { entry: number } }>;
 * const all: (Diagnostic | ConfigDiagnostic)[] = [...tokens.diagnostics, ...checkConfig(tokens)];
 */
export type DiagnosticOf<DetailByKind> = {
    [K in keyof DetailByKind]: {
        readonly kind: K;
        readonly severity: "error" | "warning" | "info" | "hint";
        /** What's wrong, in a few words, such as `` "`color.primry` does not exist" ``. */
        readonly message: string;
        /** How to fix it, when there's a clear way, such as `` "did you mean `color.primary`?" ``. */
        readonly help?: string;
        /** Where the problem is, when it is in a file. */
        readonly span?: Span;
        /** The token or group it concerns. */
        readonly path?: string;
        /**
         * The permutations that have the problem.
         *
         * dtcg's own diagnostics always have it. A problem in the resolver applies in
         * `"every permutation"`.
         * Your own kinds can leave it out.
         */
        readonly permutations?: Permutations;
        /**
         * Other places involved, each with its own message, such as where a duplicate key is also
         * written.
         */
        readonly relatedInformation?: readonly {
            readonly message: string;
            readonly span: Span;
            readonly path?: string;
        }[];
        /**
         * How an editor can show it.
         *
         * `"unnecessary"` fades it, and `"deprecated"` strikes it through.
         */
        readonly tags?: readonly ("deprecated" | "unnecessary")[];
        /** A page about this kind of diagnostic. */
        readonly docsUrl: string;
        readonly detail: DetailByKind[K];
    };
}[keyof DetailByKind];
