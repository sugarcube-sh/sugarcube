import type { FileContentResponse, Framework, RegistryItem } from "../types/registry.js";

const FRAMEWORKS: Record<Framework, true> = {
    "react": true,
    "web-components": true,
    "css-only": true,
};

export function isRegistryIndex(value: unknown): value is RegistryItem[] {
    return Array.isArray(value) && value.every(isRegistryItem);
}

export function isFileContent(value: unknown): value is FileContentResponse {
    return isObject(value) && typeof value.content === "string";
}

function isRegistryItem(value: unknown): value is RegistryItem {
    return (
        isObject(value) &&
        typeof value.name === "string" &&
        typeof value.type === "string" &&
        isOptional(value.description, isString) &&
        isOptional(value.frameworks, isStrings) &&
        Array.isArray(value.files) &&
        value.files.every(isFile) &&
        isOptional(value.tokens, isTokenMappings) &&
        isOptional(value.dependencies, isPerFramework) &&
        isOptional(value.registryDependencies, isPerFramework) &&
        isOptional(value.tokenDependencies, isStrings)
    );
}

function isFile(value: unknown): boolean {
    return isObject(value) && typeof value.path === "string" && typeof value.type === "string";
}

function isTokenMappings(value: unknown): boolean {
    return (
        isObject(value) &&
        Object.values(value).every(
            (mapping) =>
                isObject(mapping) &&
                typeof mapping.type === "string" &&
                typeof mapping.mapping === "string",
        )
    );
}

function isPerFramework(value: unknown): boolean {
    return (
        isObject(value) &&
        Object.entries(value).every(
            ([framework, names]) => Object.hasOwn(FRAMEWORKS, framework) && isStrings(names),
        )
    );
}

function isStrings(value: unknown): boolean {
    return Array.isArray(value) && value.every(isString);
}

function isString(value: unknown): boolean {
    return typeof value === "string";
}

function isOptional(value: unknown, check: (value: unknown) => boolean): boolean {
    return value === undefined || check(value);
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
