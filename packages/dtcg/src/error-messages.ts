import type { DiagnosticDetailByKind, DiagnosticKind, JsonErrorReason } from "./index.js";

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

const resolverRules: Record<
    DiagnosticDetailByKind["resolver-invalid"]["rule"],
    (name: string) => string
> = {
    "version": () => 'the resolver\'s version must be "2025.10"',
    "unknown-set": (name) => `there is no set named \`${name}\``,
    "unknown-modifier": (name) => `there is no modifier named \`${name}\``,
    "invalid-pointer": (name) => `\`${name}\` cannot be referred to from here`,
    "circular-reference": (name) => `\`${name}\` leads back to itself`,
    "duplicate-name": (name) =>
        `more than one set or modifier in the resolution order is named \`${name}\``,
    "no-contexts": (name) => `the modifier \`${name}\` has no contexts`,
    "single-context": (name) =>
        `the modifier \`${name}\` has only one context, which makes it a set`,
    "invalid-default": (name) =>
        `the default of the modifier \`${name}\` is not one of its contexts`,
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
        message: ({ rule, name }) => resolverRules[rule](name ?? ""),
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
        message: ({ ref }) => `the token \`${ref}\` does not exist`,
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
    "deprecated-reference": {
        severity: "warning",
        message: ({ ref, reason }) =>
            reason ? `\`${ref}\` is deprecated: ${reason}` : `\`${ref}\` is deprecated`,
    },
};
