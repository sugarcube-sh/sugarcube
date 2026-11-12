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
import {
    didYouMean,
    formatList,
    ignoredMessage,
    valueErrorHelpText,
    valueErrorMessage,
    valueErrorMessages,
} from "./values/value-errors.js";

type Severity = Diagnostic["severity"];

type Entry<K extends DiagnosticKind> = {
    severity: Severity | ((detail: DiagnosticDetailByKind[K]) => Severity);
    message: (detail: DiagnosticDetailByKind[K]) => string;
    help?: (detail: DiagnosticDetailByKind[K]) => string | undefined;
};

const jsonErrorMessages: Record<JsonErrorReason, string> = {
    "comment": "comments aren't allowed",
    "trailing-comma": "trailing commas aren't allowed",
    "not-an-object": "the top level must be an object",
    "invalid-symbol": "unexpected character",
    "invalid-number-format": "invalid number",
    "property-name-expected": "property name expected",
    "value-expected": "value expected",
    "colon-expected": "`:` expected",
    "comma-expected": "`,` expected",
    "close-brace-expected": "`}` expected",
    "close-bracket-expected": "`]` expected",
    "end-of-file-expected": "unexpected text after the end",
    "unexpected-end-of-comment": "unclosed comment",
    "unexpected-end-of-string": "unclosed string",
    "unexpected-end-of-number": "number cut short",
    "invalid-unicode": "`\\u` needs four hex digits",
    "invalid-escape-character": "invalid escape",
    "invalid-character": "character must be escaped",
};

const expectedTypeLabels: Record<
    Extract<ResolverProblem, { rule: "wrong-type" }>["expected"],
    string
> = {
    string: "a string",
    object: "an object",
    array: "a list",
};

const expectedPropertyLabels: Record<
    DiagnosticDetailByKind["invalid-property"]["expected"],
    string
> = {
    "string": "a string",
    "object": "an object",
    "boolean-or-string": "true, false or a string",
    "reference": "a reference",
};

function inputHeadline(problem: InputProblem): string {
    const { modifier } = problem;
    switch (problem.reason) {
        case "unknown-modifier":
            return `no modifier named \`${modifier}\``;
        case "unknown-context":
            return `\`${problem.context}\` is not a context of \`${modifier}\``;
        case "missing-modifier":
            return `no context chosen for \`${modifier}\``;
        case "not-a-string":
            return `the input for \`${modifier}\` must be a string`;
    }
}

function inputHelp(problem: InputProblem): string | undefined {
    return problem.reason === "missing-modifier"
        ? `choose ${formatList(problem.valid)}`
        : undefined;
}

function formatInput(input: Input): string {
    const entries = Object.entries(input).map(
        ([name, context]) =>
            `${isIdentifier(name) ? name : JSON.stringify(name)}: ${JSON.stringify(context)}`,
    );
    return `{ ${entries.join(", ")} }`;
}

function isIdentifier(name: string): boolean {
    return /^[A-Za-z_$][\w$]*$/.test(name);
}

const resolverRuleMessages: Record<
    Exclude<ResolverRule, "wrong-type">,
    (name: string) => string
> = {
    "version": () => '`version` must be "2025.10"',
    "missing-property": (name) => `\`${name}\` is missing`,
    "unknown-set": (name) => `no set named \`${name}\``,
    "unknown-modifier": (name) => `no modifier named \`${name}\``,
    "invalid-pointer": (name) => `can't refer to \`${name}\` from here`,
    "circular-reference": (name) => `\`${name}\` leads back to itself`,
    "resolver-as-source": (name) => `\`${name}\` is a resolver, not a token file`,
    "duplicate-name": (name) => `duplicate name \`${name}\``,
    "unknown-item-type": (name) => `\`${name}\` is not an item type`,
    "no-contexts": (name) => `\`${name}\` has no contexts`,
    "empty-resolution-order": () => "`resolutionOrder` is empty",
    "single-context": (name) => `\`${name}\` has only one context`,
    "invalid-default": (name) => `\`${name}\`'s default isn't one of its contexts`,
    "file-in-resolution-order": (name) => `\`${name}\` is a file, not a set or modifier`,
};

export const exceptionMessages = {
    couldNotFetch: (path: string) => `\`${path}\` could not be fetched`,
    notInLastRead: (path: string) =>
        `\`${path}\` wasn't part of the last read: pass its text to \`reread\`, or read again`,
    noDefinitionAtLocation: (file: string) =>
        `nothing is written at that place in \`${file}\` in this read: it comes from a read of other text`,
    permutation: (detail: PermutationErrorDetail) =>
        detail.reason === "not-read"
            ? `\`${toInputLabel(detail.input)}\` was not built by this read`
            : [inputHeadline(detail), inputHelp(detail)].filter(Boolean).join(": "),
    severalPermutations: ({ member, modifiers, example }: SeveralPermutationsDetail) => {
        const named = `${modifiers.length === 1 ? "the modifier" : "the modifiers"} ${formatList(modifiers, "and")}`;
        return `tokens.${member} needs a permutation: this resolver has ${named}. Pick one with tokens.getPermutation(${formatInput(example)}), or group them with groupPermutationsBy(tokens, …)`;
    },
    entryFile: ({ reason, files }: EntryFileErrorDetail) => {
        const named = files.map((file) => `\`${file}\``).join(", ");
        if (reason === "several-resolvers")
            return `${named} are all resolvers: name the entry to start from`;
        return files.length === 0
            ? "no files were given to read"
            : `${named} are token files with no resolver among them: a resolver says which files to read and in what order, so give one, or name the entry to start from`;
    },
    typographyNotPlaceable:
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

function formatPath(path: string): string {
    return path === "" ? "the top level" : `\`${path}\``;
}

const ownerNames = {
    resolver: "resolver",
    set: "set",
    modifier: "modifier",
    token: "token",
    group: "group",
} as const;

function formatFiles(files: readonly string[]): string {
    return formatList(files, "and");
}

export const diagnosticMessages: { [K in DiagnosticKind]: Entry<K> } = {
    "file-not-found": {
        severity: "error",
        message: ({ file }) => `can't read \`${file}\``,
    },
    "invalid-json": { severity: "error", message: ({ reason }) => jsonErrorMessages[reason] },
    "duplicate-key": {
        severity: "warning",
        message: ({ key }) => `duplicate key \`${key}\``,
    },
    "resolver-invalid": {
        severity: "error",
        message: (detail) =>
            detail.rule === "wrong-type"
                ? `\`${detail.name}\` must be ${expectedTypeLabels[detail.expected]}`
                : resolverRuleMessages[detail.rule](detail.name),
        help: ({ rule }) => (rule === "unknown-item-type" ? 'use "set" or "modifier"' : undefined),
    },
    "input-invalid": {
        severity: "error",
        message: inputHeadline,
        help: inputHelp,
    },
    "invalid-name": {
        severity: "error",
        message: ({ character }) => {
            if (character === undefined) return "a name can't be empty";
            return character === "$"
                ? "a name can't start with `$`"
                : `a name can't contain \`${character}\``;
        },
    },
    "token-and-group": {
        severity: "error",
        message: (detail) => {
            switch (detail.reason) {
                case "child":
                    return detail.found === "object"
                        ? "a token can't contain other tokens"
                        : `\`${detail.child}\` is not a token property`;
                case "declared": {
                    const other = detail.declaredAs === "token" ? "group" : "token";
                    return `\`${detail.path}\` is a ${other} in ${formatFiles(detail.otherFiles)}`;
                }
                case "ref":
                    return "`$ref` doesn't extend a group";
            }
        },
    },
    "invalid-member": {
        severity: "error",
        message: ({ name }) => `\`${name}\` is not a token or group`,
    },
    "invalid-property": {
        severity: "error",
        message: ({ property, expected }) =>
            `\`${property}\` must be ${expectedPropertyLabels[expected]}`,
        help: ({ reference }) => didYouMean(reference),
    },
    "missing-type": {
        severity: "error",
        message: () => "no `$type`",
    },
    "unknown-type": {
        severity: "error",
        message: ({ type }) =>
            type === "" ? "`$type` is empty" : `\`${type}\` is not a token type`,
        help: ({ suggestion }) => didYouMean(suggestion),
    },
    "invalid-value": {
        severity: "error",
        message: valueErrorMessage,
        help: valueErrorHelpText,
    },
    "hex-string-color": {
        severity: "error",
        message: (detail) =>
            valueErrorMessages["hex-string"]({ type: "color", reason: "hex-string", ...detail }),
    },
    "extension-invalid": {
        severity: "error",
        message: ({ key }) => `invalid \`${key}\` extension`,
    },
    "overridden-by-generator": {
        severity: "error",
        message: ({ path, from, extension }) =>
            `\`${path}\` is made by \`${extension.join(".")}\` on ${formatPath(from)}`,
    },
    "missing-reference": {
        severity: "error",
        message: ({ ref }) => `\`${ref}\` does not exist`,
        help: ({ suggestion }) => didYouMean(suggestion),
    },
    "malformed-pointer": {
        severity: "error",
        message: ({ ref, reason }) =>
            reason === "no-leading-slash"
                ? `\`${ref}\` is not a JSON Pointer`
                : "`~` and `/` must be escaped",
        help: ({ suggestion }) =>
            suggestion === undefined ? undefined : `write \`${suggestion}\``,
    },
    "not-a-token": {
        severity: "error",
        message: ({ ref }) => `\`${ref}\` is a group, not a token`,
    },
    "not-a-value": {
        severity: "error",
        message: () => "a `$ref` must point at a value",
        help: ({ suggestion }) => `write \`${suggestion}\``,
    },
    "ref-and-value": {
        severity: "error",
        message: () => "a token can't have both `$ref` and `$value`",
    },
    "reference-to-several": {
        severity: "error",
        message: ({ ref }) => `\`${ref}\` is itself a list`,
    },
    "not-a-group": {
        severity: "error",
        message: ({ ref }) => `\`${ref}\` is a token, not a group`,
    },
    "circular-reference": {
        severity: "error",
        message: ({ chain }) => `circular reference through ${chain.map(formatPath).join(", ")}`,
    },
    "type-mismatch": {
        severity: "error",
        message: ({ ref, expected, found }) => `\`${ref}\` is a ${found}, not a ${expected}`,
    },
    "whitespace-in-name": {
        severity: "warning",
        message: () => "a name can't start or end with a space",
    },
    "unknown-property": {
        severity: (detail) => ("jsonPath" in detail || detail.ignored ? "warning" : "error"),
        message: (detail) => {
            if ("jsonPath" in detail) return ignoredMessage(detail.type, detail.property);
            return `\`${detail.property}\` is not a ${ownerNames[detail.owner]} property`;
        },
        help: (detail) => ("jsonPath" in detail ? undefined : didYouMean(detail.suggestion)),
    },
    "misspelt-property": {
        severity: "error",
        message: ({ key, owner }) => `\`${key}\` is not a ${owner} property`,
        help: ({ property }) => didYouMean(property),
    },
    "permutation-limit": {
        severity: "warning",
        message: ({ count, limit }) =>
            `too many combinations: ${count}, over the limit of ${limit}`,
    },
    "not-in-resolution-order": {
        severity: "hint",
        message: ({ item, name }) => `the ${item} \`${name}\` is never used`,
    },
    "deprecated-reference": {
        severity: "warning",
        message: ({ ref, reason }) =>
            reason ? `\`${ref}\` is deprecated: ${reason}` : `\`${ref}\` is deprecated`,
    },
};
