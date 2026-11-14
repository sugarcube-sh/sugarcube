import { type Input, type PermutationErrorDetail, toInputLabel } from "@sugarcube-sh/dtcg";
import type { Conflict, FileOp, Refusal } from "./index.js";

export const exceptionMessages = {
    operationDoesNotFit:
        "an operation's edits don't fit the design tokens it was given; make them from the tokens the operation is passed",
    stepsNoLongerFit:
        "the session's unsaved steps no longer fit the files they were put back on, so the version before the last can't be worked out",
};

export const fixTitles = {
    useSimilar: (name: string) => `use \`${name}\`, which has a similar name`,
    deleteEarlier: (key: string) => `delete the earlier \`${key}\`, which is never used`,
    writePointer: (pointer: string) => `write it as \`${pointer}\``,
    deleteType: "delete this `$type`, so the token takes its group's type",
    writeExtendsAsReference: (reference: string) => `write it as the reference \`${reference}\``,
    writeHexAsObject: "write the color as an object, keeping the hex",
    writeMeasureAsObject: (type: string) => `write the ${type} as an object`,
    writeFullHex: (hex: string) =>
        `write the hex with ${hex.length === 9 ? "eight" : "six"} digits, \`${hex}\``,
    writeReferenceAsPointer: (pointer: string) =>
        `write it as the pointer \`${pointer}\`, which can stand for part of a value`,
};

type WithoutReason<T> = T extends unknown ? Omit<T, "reason"> : never;

type RefusalDetail = WithoutReason<Refusal>;

const refusalReasons: {
    [K in Refusal["kind"]]: (facts: Extract<RefusalDetail, { kind: K }>) => string;
} = {
    "not-found": ({ path }) => `there is no token or group \`${path}\``,
    "top-level": () => "the top level of a file has no name, and holds everything in the file",
    "generated": ({ path, from, extension }) => {
        const location = from === "" ? "at the top of its file" : `on \`${from}\``;
        return `\`${path}\` is generated from \`${extension.join(".")}\` ${location}; change the extension instead`;
    },
    "not-a-group": ({ path }) => `\`${path}\` is a token, so nothing can be made inside it`,
    "taken": ({ path }) => `\`${path}\` already exists`,
    "override-instead": ({ path, input }) =>
        `\`${path}\` already exists for every context; to give ${quoteInput(input)} its own value, change it for that context`,
    "invalid-name": ({ name, character }) =>
        character === undefined
            ? "a name can't be empty"
            : `\`${name}\` can't be a name: ${character === "$" ? "a leading `$` marks a property" : `\`${character}\` is used by references`}`,
    "inherited": ({ path, from }) =>
        `\`${path}\` comes from \`${from}\` through \`$extends\`; change it there`,
    "no-permutation": ({ input, cause: why }) =>
        `there is no permutation for ${quoteInput(input)}: ${permutationErrorMessages[why]}`,
    "several-contexts": ({ input }) =>
        `an override for ${quoteInput(input)} at once can't be written: no file is read by that combination alone`,
    "no-file-for-context": ({ path, input }) =>
        `\`${path}\` can't be written for ${quoteInput(input)}: it reads no whole file of its own to hold it`,
    "no-shared-file": ({ path }) =>
        `\`${path}\` can't be written for every permutation: no whole file they all read can hold it`,
    "hidden-by-later-file": ({ path, input, file }) =>
        `\`${path}\` can't be overridden for ${quoteInput(input)}: \`${file}\` is read after its files, so it would still win`,
    "no-shared-value": ({ path }) =>
        `no file every permutation reads writes \`${path}\`, only contexts do; change it for one context`,
    "not-a-definition": ({ path, at }) =>
        `\`${path}\` isn't written at that place in \`${at.file}\`; take the place from \`getDefinitions\``,
    "part-in-reference": ({ path, part }) =>
        `\`${path}\` refers to another token on the way to \`${part.join(".")}\`, so that part isn't written there`,
    "no-such-part": ({ path, part }) => `\`${path}\` has no part \`${part.join(".")}\``,
    "removed-since": ({ path, file }) =>
        `${path === undefined ? "what your edit changes" : `\`${path}\``} in \`${file}\` was removed or renamed since, so yours can't be written over it`,
};

const permutationErrorMessages: Record<PermutationErrorDetail["reason"], string> = {
    "unknown-modifier": "the resolver doesn't declare that modifier",
    "unknown-context": "the resolver doesn't declare that context",
    "missing-modifier": "a modifier with no default was left out",
    "not-a-string": "a context was given as something other than a string",
    "not-read": "the read didn't build it",
};

export function refuse(facts: RefusalDetail): { refusal: Refusal } {
    const reason = (refusalReasons[facts.kind] as (facts: RefusalDetail) => string)(facts);
    return { refusal: { ...facts, reason } as Refusal };
}

export function createConflict(op: FileOp, kind: Conflict["kind"]): Conflict {
    return { op, kind, reason: formatConflictReason(op, kind) };
}

function formatConflictReason(op: FileOp, kind: Conflict["kind"]): string {
    const location =
        "jsonPath" in op ? `\`${op.jsonPath.join(".")}\` in \`${op.file}\`` : `\`${op.file}\``;
    switch (kind) {
        case "not-read":
            return op.kind === "create-file"
                ? `nothing reads \`${op.file}\`, so it would be lost`
                : `\`${op.file}\` is not one of the files read`;
        case "gone":
            return `${location} is no longer there`;
        case "changed":
            return `${location} has changed since the edit was made`;
        case "taken":
            return op.kind === "rename-key"
                ? `${location} can't be renamed: a sibling is already called \`${op.name}\``
                : `${location} already holds something else`;
        case "not-a-group":
            return `${location} runs through something that is not a group, or past the end of a list`;
    }
}

function quoteInput(input: Input): string {
    return `\`${toInputLabel(input)}\``;
}
