import type {
    ColorFallbackStrategy,
    FluidViewport,
    PermutationConfig,
    StudioConfig,
    SugarcubeConfig,
    UtilitiesConfig,
    VariableNameFunction,
    VariablesConfig,
} from "../types/config.js";
import type { Direction, UtilityClassConfig } from "../types/utilities.js";
import {
    type Check,
    boolean,
    nonEmptyString,
    func,
    array,
    matching,
    number,
    object,
    oneOf,
    oneOrArray,
    optional,
    record,
    string,
} from "./checks.js";

const source: Check<string> = (value, setting, issues): value is string => {
    if (!string(value, setting, issues)) return false;
    if (value === "") {
        issues.push({ reason: "empty-source", setting });
        return false;
    }
    if (value.includes("*") && !value.endsWith(".*")) {
        issues.push({ reason: "wrong-form", setting, value, form: "source" });
        return false;
    }
    return true;
};

const direction = oneOf<Direction>({
    top: true,
    right: true,
    bottom: true,
    left: true,
    x: true,
    y: true,
    full: true,
    all: true,
});

const utility = object<UtilityClassConfig>({
    source,
    directions: optional(oneOrArray(direction, array(direction))),
    prefix: optional(string),
    stripDuplicates: optional(boolean),
    safelist: optional(oneOrArray(boolean, array(string))),
});

const nonEmptyStrings = array(nonEmptyString);

const selectors: Check<string[]> = (value, setting, issues): value is string[] => {
    if (Array.isArray(value) && value.length === 0) {
        issues.push({ reason: "no-selectors", setting });
        return false;
    }
    return nonEmptyStrings(value, setting, issues);
};

const permutation = object<PermutationConfig>({
    input: record(string),
    selector: oneOrArray(nonEmptyString, selectors),
    atRule: optional(string),
    path: optional(string),
});

const variables = object<VariablesConfig>({
    path: optional(string),
    prefix: optional(string),
    case: optional(oneOf<"kebab">({ kebab: true })),
    delimiter: optional(string),
    variableName: optional(func<VariableNameFunction>()),
    layer: optional(string),
    transforms: optional(
        object<NonNullable<VariablesConfig["transforms"]>>({
            fluid: optional(object<FluidViewport>({ min: number, max: number })),
            colorFallbackStrategy: optional(
                oneOf<ColorFallbackStrategy>({ native: true, polyfill: true }),
            ),
        }),
    ),
    permutations: optional(array(permutation)),
    redeclareDependents: optional(boolean),
    propagateDependents: optional(boolean),
});

const utilities = object<UtilitiesConfig>({
    path: optional(string),
    layer: optional(string),
    classes: optional(record(oneOrArray(utility, array(utility)))),
});

const studio = object<StudioConfig>({
    repository: optional(matching("repository", /^[\w.-]+\/[\w.-]+$/)),
    branch: optional(nonEmptyString),
    githubApp: optional(matching("app", /^[a-z0-9][a-z0-9-]*$/)),
    save: optional(boolean),
    signInPath: optional(matching("sign-in", /^\/(?!\/)/)),
});

export const checkConfig = object<SugarcubeConfig>({
    resolver: optional(string),
    variables: optional(variables),
    utilities: optional(utilities),
    content: optional(array(string)),
    components: optional(string),
    cube: optional(string),
    studio: optional(studio),
});
