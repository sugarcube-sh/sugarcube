import type {
    DiagnosticDetailByKind,
    DiagnosticKind,
    JsonErrorReason,
    ResolverProblem,
    ResolverRule,
} from "./index.js";

type Entry<K extends DiagnosticKind> = {
    severity: "error" | "warning";
    message: (detail: DiagnosticDetailByKind[K]) => string;
};

const jsonReasons: Record<JsonErrorReason, string> = {
    "comment": "a token file is JSON, which has no comments",
    "not-an-object": "the top level of the file must be an object",
    "invalid-symbol": "this is not valid JSON: there is a character that cannot be here",
    "invalid-number-format": "this is not valid JSON: a number is not written correctly",
    "property-name-expected": "this is not valid JSON: a property name is missing",
    "value-expected": "this is not valid JSON: a value is missing",
    "colon-expected": "this is not valid JSON: a colon is missing",
    "comma-expected": "this is not valid JSON: a comma is missing",
    "close-brace-expected": "this is not valid JSON: a closing brace is missing",
    "close-bracket-expected": "this is not valid JSON: a closing bracket is missing",
    "end-of-file-expected": "this is not valid JSON: there is more after the end of the value",
    "unexpected-end-of-comment": "this is not valid JSON: a comment is not closed",
    "unexpected-end-of-string": "this is not valid JSON: a string is not closed",
    "unexpected-end-of-number": "this is not valid JSON: a number is cut short",
    "invalid-unicode": "this is not valid JSON: a \\u escape needs four hex digits",
    "invalid-escape-character": "this is not valid JSON: an escape sequence is not valid",
    "invalid-character": "this is not valid JSON: a string holds a character that must be escaped",
};

const expectedWords: Record<Extract<ResolverProblem, { rule: "wrong-type" }>["expected"], string> =
    {
        string: "a string",
        object: "an object",
        array: "a list",
    };

const foundWords: Record<DiagnosticDetailByKind["invalid-member"]["found"], string> = {
    string: "a string",
    number: "a number",
    boolean: "true or false",
    null: "null",
    array: "a list",
};

const propertyWords: Record<DiagnosticDetailByKind["invalid-property"]["expected"], string> = {
    "string": "a string",
    "object": "an object",
    "boolean-or-string": "true, false or a string",
    "reference": 'a reference, such as "{group}" or { "$ref": "#/group" }',
};

const resolverRules: Record<Exclude<ResolverRule, "wrong-type">, (name: string) => string> = {
    "version": () => 'the resolver\'s version must be "2025.10"',
    "missing-property": (name) => `\`${name}\` is missing`,
    "unknown-set": (name) => `there is no set named \`${name}\``,
    "unknown-modifier": (name) => `there is no modifier named \`${name}\``,
    "invalid-pointer": (name) => `\`${name}\` cannot be referred to from here`,
    "circular-reference": (name) => `\`${name}\` leads back to itself`,
    "resolver-as-source": (name) => `\`${name}\` is a resolver, and a source must hold tokens`,
    "duplicate-name": (name) =>
        `more than one set or modifier in the resolution order is named \`${name}\``,
    "unknown-item-type": (name) =>
        `\`${name}\` is not a kind of item: an item in the resolution order is a "set" or a "modifier"`,
    "no-contexts": (name) => `the modifier \`${name}\` has no contexts`,
    "single-context": (name) =>
        `the modifier \`${name}\` has only one context, which makes it a set`,
    "invalid-default": (name) =>
        `the default of the modifier \`${name}\` is not one of its contexts`,
};

export const relatedMessages = {
    declaredAs: (kind: "token" | "group") => `declared as a ${kind} here`,
    partOfTheLoop: "part of the same loop",
    alsoUsedHere: "also used here",
};

export const fixTitles = {
    useType: (type: string) => `use \`${type}\`, which has a similar name`,
    hexToObject: "write the color as an object, keeping the hex",
    useReference: (path: string) => `use \`${path}\`, which has a similar name`,
};

export const diagnosticMessages: { [K in DiagnosticKind]: Entry<K> } = {
    "file-not-found": {
        severity: "error",
        message: ({ file }) => `the file \`${file}\` could not be read`,
    },
    "invalid-json": { severity: "error", message: ({ reason }) => jsonReasons[reason] },
    "duplicate-key": {
        severity: "error",
        message: ({ key }) =>
            `\`${key}\` is written more than once in this object, and only the last is used`,
    },
    "resolver-invalid": {
        severity: "error",
        message: (detail) =>
            detail.rule === "wrong-type"
                ? `\`${detail.name}\` must be ${expectedWords[detail.expected]}`
                : resolverRules[detail.rule](detail.name),
    },
    "input-invalid": {
        severity: "error",
        message: ({ reason, modifier, context }) => {
            if (reason === "unknown-modifier") return `there is no modifier named \`${modifier}\``;
            if (reason === "unknown-context")
                return `\`${context}\` is not a context of the modifier \`${modifier}\``;
            if (reason === "missing-modifier")
                return `the modifier \`${modifier}\` has no default, so an input must choose one of its contexts`;
            return `the input for the modifier \`${modifier}\` must be a string`;
        },
    },
    "invalid-name": {
        severity: "error",
        message: ({ name, character }) =>
            character === "$"
                ? `the name \`${name}\` starts with \`$\`, which is kept for the specification's own properties`
                : `the name \`${name}\` contains \`${character}\`, which a name cannot contain`,
    },
    "token-and-group": {
        severity: "error",
        message: () =>
            "this has a `$value`, so it is a token, and a token cannot hold tokens or groups",
    },
    "invalid-member": {
        severity: "error",
        message: ({ name, found }) =>
            `\`${name}\` is ${foundWords[found]}, and a group holds only tokens and groups, which are objects`,
    },
    "invalid-property": {
        severity: "error",
        message: ({ property, expected }) => `\`${property}\` must be ${propertyWords[expected]}`,
    },
    "missing-type": {
        severity: "error",
        message: () => "no type can be worked out for this token",
    },
    "unknown-type": {
        severity: "error",
        message: ({ type }) => `\`${type}\` is not a token type`,
    },
    "invalid-value": {
        severity: "error",
        message: ({ type }) => `this is not a valid ${type} value`,
    },
    "hex-string-color": {
        severity: "error",
        message: ({ value }) => `\`${value}\` is a hex string, and a color must be an object`,
    },
    "extension-invalid": {
        severity: "error",
        message: ({ key }) => `the \`${key}\` extension is not valid`,
    },
    "missing-reference": {
        severity: "error",
        message: ({ ref }) => `\`${ref}\` does not exist`,
    },
    "not-a-token": {
        severity: "error",
        message: ({ ref }) => `\`${ref}\` is a group, and a reference must name a token`,
    },
    "reference-to-several": {
        severity: "error",
        message: ({ ref, count }) =>
            `\`${ref}\` holds ${count}, and a reference in a list stands for one`,
    },
    "not-a-group": {
        severity: "error",
        message: ({ ref }) => `\`${ref}\` is a token, and only a group can be extended`,
    },
    "circular-reference": {
        severity: "error",
        message: ({ chain }) =>
            `these references lead back to where they started: ${chain.join(" → ")}`,
    },
    "type-mismatch": {
        severity: "error",
        message: ({ ref, expected, found }) =>
            `\`${ref}\` is a ${found} token, where a ${expected} is needed`,
    },
    "whitespace-in-name": {
        severity: "warning",
        message: ({ name }) => `the name \`${name}\` starts or ends with a space`,
    },
    "generator-overridden": {
        severity: "warning",
        message: ({ generator, group, name }) =>
            `\`${name}\` in \`${group}\` takes the place of the one the ${generator} generator would make`,
    },
    "permutation-limit": {
        severity: "warning",
        message: ({ count, limit, built }) =>
            `the modifiers make ${count} combinations, more than the limit of ${limit}, so ${built} were built: the default, and each context on its own`,
    },
    "no-default": {
        severity: "warning",
        message: ({ modifiers }) =>
            `${modifiers.map((name) => `\`${name}\``).join(", ")} ${modifiers.length === 1 ? "has" : "have"} no default, so contexts of the other modifiers could not be built on their own`,
    },
    "deprecated-reference": {
        severity: "warning",
        message: ({ ref, reason }) =>
            reason ? `\`${ref}\` is deprecated: ${reason}` : `\`${ref}\` is deprecated`,
    },
};
