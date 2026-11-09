import type {
    ColorFallbackStrategy,
    FluidConfig,
    PermutationConfig,
    StudioConfig,
    SugarcubeConfig,
    UtilitiesOutputConfig,
    VariableNameFn,
    VariablesConfig,
} from "../types/config.js";
import type { DirectionalVariant, PropertyUtilityConfig } from "../types/utilities.js";
import {
    type Check,
    boolean,
    filled,
    func,
    list,
    matching,
    number,
    object,
    oneOf,
    oneOrList,
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

const direction = oneOf<DirectionalVariant>({
    top: true,
    right: true,
    bottom: true,
    left: true,
    x: true,
    y: true,
    full: true,
    all: true,
});

const utility = object<PropertyUtilityConfig>({
    source,
    directions: optional(oneOrList(direction, list(direction))),
    prefix: optional(string),
    stripDuplicates: optional(boolean),
    safelist: optional(oneOrList(boolean, list(string))),
});

const filledList = list(filled);

const selectors: Check<string[]> = (value, setting, issues): value is string[] => {
    if (Array.isArray(value) && value.length === 0) {
        issues.push({ reason: "no-selectors", setting });
        return false;
    }
    return filledList(value, setting, issues);
};

const permutation = object<PermutationConfig>({
    input: record(string),
    selector: oneOrList(filled, selectors),
    atRule: optional(string),
    path: optional(string),
});

const variables = object<VariablesConfig>({
    path: optional(string),
    prefix: optional(string),
    case: optional(oneOf<"kebab">({ kebab: true })),
    delimiter: optional(string),
    variableName: optional(func<VariableNameFn>()),
    layer: optional(string),
    transforms: optional(
        object<NonNullable<VariablesConfig["transforms"]>>({
            fluid: optional(object<FluidConfig>({ min: number, max: number })),
            colorFallbackStrategy: optional(
                oneOf<ColorFallbackStrategy>({ native: true, polyfill: true }),
            ),
        }),
    ),
    permutations: optional(list(permutation)),
    redeclareDependents: optional(boolean),
    propagateDependents: optional(boolean),
});

const utilities = object<UtilitiesOutputConfig>({
    path: optional(string),
    layer: optional(string),
    classes: optional(record(oneOrList(utility, list(utility)))),
});

const studio = object<StudioConfig>({
    repository: optional(matching("repository", /^[\w.-]+\/[\w.-]+$/)),
    branch: optional(filled),
    app: optional(matching("app", /^[a-z0-9][a-z0-9-]*$/)),
    save: optional(boolean),
    signIn: optional(matching("sign-in", /^\/(?!\/)/)),
});

export const checkConfig = object<SugarcubeConfig>({
    resolver: optional(string),
    variables: optional(variables),
    utilities: optional(utilities),
    content: optional(list(string)),
    components: optional(string),
    cube: optional(string),
    studio: optional(studio),
});
