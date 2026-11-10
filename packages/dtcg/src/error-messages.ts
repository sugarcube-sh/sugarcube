import type {
    Diagnostic,
    DiagnosticDetailByKind,
    DiagnosticKind,
    EntryFileErrorDetail,
    Input,
    JsonErrorReason,
    InputProblem,
    PermutationErrorDetail,
    ResolverProblem,
    ResolverRule,
    SeveralPermutationsDetail,
} from "./model.js";
import { toInputLabel } from "./lookup/permutation-label.js";
import { isSpecKey } from "./read/spec-keys.js";
import {
    didYouMean,
    ignoredMessage,
    valueErrorMessage,
    valueErrorMessages,
} from "./values/value-errors.js";

type Severity = Diagnostic["severity"];

type Entry<K extends DiagnosticKind> = {
    severity: Severity | ((detail: DiagnosticDetailByKind[K]) => Severity);
    message: (detail: DiagnosticDetailByKind[K]) => string;
};

const jsonReasons: Record<JsonErrorReason, string> = {
    "comment": "a token file is JSON, which has no comments",
    "trailing-comma": "a token file is JSON, which has no trailing commas",
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

function noModifierNamed(name: string): string {
    return `there is no modifier named \`${name}\``;
}

function inputWords(problem: InputProblem): string {
    const { modifier } = problem;
    switch (problem.reason) {
        case "unknown-modifier":
            return noModifierNamed(modifier);
        case "unknown-context":
            return `\`${problem.context}\` is not a context of the modifier \`${modifier}\``;
        case "missing-modifier":
            return `the input doesn't choose a context for the modifier \`${modifier}\`, which has no default: choose ${listed(problem.valid)}`;
        case "not-a-string":
            return `the input for the modifier \`${modifier}\` must be a string`;
    }
}

function inputText(input: Input): string {
    const entries = Object.entries(input).map(
        ([name, context]) =>
            `${plainName(name) ? name : JSON.stringify(name)}: ${JSON.stringify(context)}`,
    );
    return `{ ${entries.join(", ")} }`;
}

function plainName(name: string): boolean {
    return /^[A-Za-z_$][\w$]*$/.test(name);
}

function listed(names: readonly string[], joiner: "or" | "and" = "or"): string {
    const quoted = names.map((name) => `\`${name}\``);
    const last = quoted.pop();
    return quoted.length === 0 ? (last ?? "") : `${quoted.join(", ")} ${joiner} ${last}`;
}

const resolverRules: Record<Exclude<ResolverRule, "wrong-type">, (name: string) => string> = {
    "version": () => 'the resolver\'s version must be "2025.10"',
    "missing-property": (name) => `\`${name}\` is missing`,
    "unknown-set": (name) => `there is no set named \`${name}\``,
    "unknown-modifier": (name) => noModifierNamed(name),
    "invalid-pointer": (name) => `\`${name}\` cannot be referred to from here`,
    "circular-reference": (name) => `\`${name}\` leads back to itself`,
    "resolver-as-source": (name) => `\`${name}\` is a resolver, and a source must hold tokens`,
    "duplicate-name": (name) =>
        `more than one set or modifier in the resolution order is named \`${name}\``,
    "unknown-item-type": (name) =>
        `\`${name}\` is not a kind of item: an item in the resolution order is a "set" or a "modifier"`,
    "no-contexts": (name) => `the modifier \`${name}\` has no contexts`,
    "empty-resolution-order": () =>
        "`resolutionOrder` is empty: it needs at least one set or modifier",
    "single-context": (name) =>
        `the modifier \`${name}\` has only one context, which makes it a set`,
    "invalid-default": (name) =>
        `the default of the modifier \`${name}\` is not one of its contexts`,
    "file-in-resolution-order": (name) =>
        `\`${name}\` is a file, and an item in the resolution order is a set or a modifier`,
};

export const thrownMessages = {
    couldNotFetch: (path: string) => `\`${path}\` could not be fetched`,
    notInLastRead: (path: string) =>
        `\`${path}\` wasn't part of the last read: pass its text to \`reread\`, or read again`,
    nothingWrittenThere: (file: string) =>
        `nothing is written at that place in \`${file}\` in this read: it comes from a read of other text`,
    permutation: (detail: PermutationErrorDetail) =>
        detail.reason === "not-read"
            ? `\`${toInputLabel(detail.input)}\` was not built by this read`
            : inputWords(detail),
    severalPermutations: ({ asked, modifiers, example }: SeveralPermutationsDetail) => {
        const named = `${modifiers.length === 1 ? "the modifier" : "the modifiers"} ${listed(modifiers, "and")}`;
        return `tokens.${asked} needs a permutation: this resolver has ${named}. Pick one with tokens.getPermutation(${inputText(example)}), or group them with groupPermutationsBy(tokens, …)`;
    },
    entryFile: ({ reason, files }: EntryFileErrorDetail) => {
        const named = files.map((file) => `\`${file}\``).join(", ");
        if (reason === "several-resolvers")
            return `${named} are all resolvers: name the entry to start from`;
        return files.length === 0
            ? "no files were given to read"
            : `${named} are token files with no resolver among them: a resolver says which files to read and in what order, so give one, or name the entry to start from`;
    },
    typographyPlaced:
        "a typography value is one value per CSS property, so write`…` cannot place it whole: place the CSS property's value you mean",
    asyncSchema: (key: string) =>
        `the schema for \`${key}\` returned a Promise: extension schemas must validate synchronously`,
    emptyResult: "an extension reader's result needs a value, or a problem reported first",
    notATokenType: (type: string) => `\`${type}\` is not a token type; use one of \`tokenTypes\``,
};

export const relatedMessages = {
    declaredAs: (kind: "token" | "group") => `declared as a ${kind} here`,
    partOfTheLoop: "part of the same loop",
    alsoUsedHere: "also used here",
    alsoWrittenHere: "also written here",
    madeByThisExtension: "made by this extension",
    modifierDeclaredHere: "the modifier is declared here",
};

function pathWords(path: string): string {
    return path === "" ? "the top level" : `\`${path}\``;
}

const ownerWords = {
    resolver: "the resolver",
    set: "a set",
    modifier: "a modifier",
    token: "a token",
    group: "a group",
} as const;

export const diagnosticMessages: { [K in DiagnosticKind]: Entry<K> } = {
    "file-not-found": {
        severity: "error",
        message: ({ file }) => `the file \`${file}\` could not be read`,
    },
    "invalid-json": { severity: "error", message: ({ reason }) => jsonReasons[reason] },
    "duplicate-key": {
        severity: "warning",
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
        message: inputWords,
    },
    "invalid-name": {
        severity: "error",
        message: ({ name, character }) => {
            if (character === undefined) return "a name can't be empty";
            return character === "$"
                ? `the name \`${name}\` starts with \`$\`, which is kept for the specification's own properties`
                : `the name \`${name}\` contains \`${character}\`, which a name cannot contain`;
        },
    },
    "token-and-group": {
        severity: "error",
        message: (detail) => {
            switch (detail.reason) {
                case "child":
                    return `\`${detail.child}\` is inside a token (it has a \`$value\`), and a token cannot hold tokens or groups`;
                case "declared":
                    return `this is a ${detail.here} here but a ${detail.here === "token" ? "group" : "token"} in another file`;
                case "ref":
                    return `this has a \`$ref\`, which makes it a token, and a token cannot hold tokens or groups; to extend a group, use \`$extends\``;
            }
        },
    },
    "invalid-member": {
        severity: "error",
        message: ({ name, found }) =>
            `\`${name}\` is ${foundWords[found]}, and a group holds only tokens and groups, which are objects`,
    },
    "invalid-property": {
        severity: "error",
        message: ({ property, expected, reference }) =>
            `\`${property}\` must be ${propertyWords[expected]}${didYouMean(reference)}`,
    },
    "missing-type": {
        severity: "error",
        message: () => "no type can be worked out for this token",
    },
    "unknown-type": {
        severity: "error",
        message: ({ type, similar }) =>
            type === ""
                ? "`$type` is empty, and a token needs a type"
                : `\`${type}\` is not a token type${didYouMean(similar)}`,
    },
    "invalid-value": {
        severity: "error",
        message: valueErrorMessage,
    },
    "hex-string-color": {
        severity: "error",
        message: (detail) =>
            valueErrorMessages["hex-string"]({ type: "color", reason: "hex-string", ...detail }),
    },
    "extension-invalid": {
        severity: "error",
        message: ({ key }) => `the \`${key}\` extension is not valid`,
    },
    "written-generated": {
        severity: "error",
        message: ({ path, from, extension, written }) => {
            const where = `on ${pathWords(from)}`;
            const what = written === "token" ? "value" : "group";
            return `\`${path}\` is made by \`${extension.join(".")}\` ${where}, so the ${what} written here is not used; change the extension instead`;
        },
    },
    "missing-reference": {
        severity: "error",
        message: ({ ref, similar }) => `\`${ref}\` does not exist${didYouMean(similar)}`,
    },
    "malformed-pointer": {
        severity: "error",
        message: ({ ref, reason, corrected }) => {
            const problem =
                reason === "no-leading-slash"
                    ? `\`${ref}\` is not a JSON Pointer, which starts with \`#/\``
                    : `\`${ref}\` is not a JSON Pointer: in one, \`~\` is written \`~0\` and \`/\` is written \`~1\``;
            return corrected === undefined ? problem : `${problem}; write it as \`${corrected}\``;
        },
    },
    "not-a-token": {
        severity: "error",
        message: ({ ref }) => `\`${ref}\` is a group, and a reference must name a token`,
    },
    "not-a-value": {
        severity: "error",
        message: ({ ref, corrected }) =>
            `\`${ref}\` reaches a token, not its value; write it as \`${corrected}\``,
    },
    "ref-and-value": {
        severity: "error",
        message: () => "a token has `$ref` or `$value`, not both, so its `$ref` is not read",
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
            `these references lead back to where they started: ${chain.map(pathWords).join(", ")}`,
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
    "unknown-property": {
        severity: (detail) => ("jsonPath" in detail || detail.ignored ? "warning" : "error"),
        message: (detail) => {
            if ("jsonPath" in detail) return ignoredMessage(detail.type, detail.property);
            const { property, owner, similar, ignored } = detail;
            const notAProperty = `\`${property}\` is not a property of ${ownerWords[owner]}`;
            if (ignored) return `${notAProperty}, so it is ignored`;
            if (similar !== undefined) return `${notAProperty}${didYouMean(similar)}`;
            if (owner === "resolver" || isSpecKey(property)) return notAProperty;
            return `${notAProperty}: put your own data in \`$extensions\``;
        },
    },
    "misspelt-property": {
        severity: "error",
        message: ({ written, property, owner }) =>
            `\`${written}\` is not a ${owner} property; did you mean \`${property}\`?`,
    },
    "permutation-limit": {
        severity: "warning",
        message: ({ count, limit, built }) =>
            `the modifiers make ${count} combinations, more than the limit of ${limit}, so each context was built on its own instead: ${built} ${built === 1 ? "permutation" : "permutations"}`,
    },
    "not-in-resolution-order": {
        severity: "hint",
        message: ({ item, name }) =>
            `the ${item} \`${name}\` is never read: nothing in \`resolutionOrder\` reaches it`,
    },
    "deprecated-reference": {
        severity: "warning",
        message: ({ ref, reason }) =>
            reason ? `\`${ref}\` is deprecated: ${reason}` : `\`${ref}\` is deprecated`,
    },
};
