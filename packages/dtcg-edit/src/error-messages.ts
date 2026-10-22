import { type Input, type PermutationErrorDetail, permutationLabel } from "@sugarcube-sh/dtcg";
import type { Conflict, FileOp, Refusal } from "./index.js";

export const thrown = {
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
    extendsAsReference: (reference: string) => `write it as the reference \`${reference}\``,
    hexToObject: "write the color as an object, keeping the hex",
    measureAsObject: (type: string) => `write the ${type} as an object`,
    fullHex: (hex: string) =>
        `write the hex with ${hex.length === 9 ? "eight" : "six"} digits, \`${hex}\``,
    referenceAsPointer: (pointer: string) =>
        `write it as the pointer \`${pointer}\`, which can stand for part of a value`,
};

type Facts<T> = T extends unknown ? Omit<T, "reason"> : never;

type RefusalFacts = Facts<Refusal>;

const refusalReasons: {
    [K in Refusal["kind"]]: (facts: Extract<RefusalFacts, { kind: K }>) => string;
} = {
    "not-found": ({ path }) => `there is no token or group \`${path}\``,
    "generated": ({ path, from, extension }) => {
        const where = from === undefined ? "at the top of its file" : `on \`${from}\``;
        return `\`${path}\` is generated from \`${extension.join(".")}\` ${where}; change the extension instead`;
    },
    "not-a-group": ({ path }) => `\`${path}\` is a token, so nothing can be made inside it`,
    "taken": ({ path }) => `\`${path}\` already exists`,
    "override-instead": ({ path, input }) =>
        `\`${path}\` already exists for every context; to give ${named(input)} its own value, change it for that context`,
    "invalid-name": ({ name, character }) =>
        character === undefined
            ? "a name can't be empty: no path reaches it"
            : `\`${name}\` can't be a name: ${character === "$" ? "a leading `$` marks a property" : `\`${character}\` is used by references`}`,
    "inherited": ({ path, from }) =>
        `\`${path}\` comes from \`${from}\` through \`$extends\`; change it there`,
    "no-permutation": ({ input, why }) =>
        `there is no permutation for ${named(input)}: ${permutationGaps[why]}`,
    "several-contexts": ({ input }) =>
        `an override for ${named(input)} at once can't be written: no file is read by that combination alone`,
    "no-file-for-context": ({ path, input }) =>
        `\`${path}\` can't be written for ${named(input)}: it reads no whole file of its own to hold it`,
    "no-shared-file": ({ path }) =>
        `\`${path}\` can't be written for every permutation: no whole file they all read can hold it`,
    "hidden-by-later-file": ({ path, input, file }) =>
        `\`${path}\` can't be overridden for ${named(input)}: \`${file}\` is read after its files, so it would still win`,
    "no-shared-value": ({ path }) =>
        `no file every permutation reads writes \`${path}\`, only contexts do; change it for one context`,
    "not-written-there": ({ path, at }) =>
        `\`${path}\` isn't written at that place in \`${at.file}\`; take the place from \`writtenAt\``,
    "part-in-reference": ({ path, part }) =>
        `\`${path}\` refers to another token on the way to \`${part.join(".")}\`, so that part isn't written there`,
    "no-such-part": ({ path, part }) => `\`${path}\` has no part \`${part.join(".")}\``,
    "gone-elsewhere": ({ path, file }) =>
        `${path === undefined ? "what your edit changes" : `\`${path}\``} in \`${file}\` was removed or renamed since, so yours can't be written over it`,
};

const permutationGaps: Record<PermutationErrorDetail["reason"], string> = {
    "unknown-modifier": "the resolver doesn't declare that modifier",
    "unknown-context": "the resolver doesn't declare that context",
    "missing-modifier": "a modifier with no default was left out",
    "not-a-string": "a context was given as something other than a string",
    "not-read": "the read didn't build it",
};

export function refused(facts: RefusalFacts): { refused: Refusal } {
    const reason = (refusalReasons[facts.kind] as (facts: RefusalFacts) => string)(facts);
    return { refused: { ...facts, reason } as Refusal };
}

export function conflict(op: FileOp, kind: Conflict["kind"]): Conflict {
    return { op, kind, reason: conflictReason(op, kind) };
}

function conflictReason(op: FileOp, kind: Conflict["kind"]): string {
    const place =
        "jsonPath" in op ? `\`${op.jsonPath.join(".")}\` in \`${op.file}\`` : `\`${op.file}\``;
    switch (kind) {
        case "not-read":
            return op.kind === "createFile"
                ? `nothing reads \`${op.file}\`, so it would be lost`
                : `\`${op.file}\` is not one of the files read`;
        case "gone":
            return `${place} is no longer there`;
        case "changed":
            return `${place} has changed since the edit was made`;
        case "taken":
            return op.kind === "renameKey"
                ? `${place} can't be renamed: a sibling is already called \`${op.name}\``
                : `${place} already holds something else`;
        case "not-a-group":
            return `${place} runs through something that is not a group, or past the end of a list`;
    }
}

function named(input: Input): string {
    return `\`${permutationLabel(input)}\``;
}
