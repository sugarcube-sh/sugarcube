import { ErrorMessages } from "../constants/error-messages.js";
import type { UtilitiesConfig } from "../types/config.js";
import type { ConvertedToken, NormalizedConvertedTokens } from "../types/convert.js";
import type { NodeMetadata } from "../types/tokens.js";
import type { DirectionalVariant, PropertyUtilityConfig } from "../types/utilities.js";
import type { TokenType } from "../types/dtcg.js";

type CSSObject = Record<string, string | number | undefined>;

const CSS_VAR_PREFIX = "--";
const DIRECTION_SEPARATOR = "-";
const EXCLUDED_DIRECTIONS = ["all", "full"] as const;
const DIRECTION_ABBREVIATIONS: Record<DirectionalVariant, string> = {
    top: "t",
    right: "r",
    bottom: "b",
    left: "l",
    x: "x",
    y: "y",
    full: "",
    all: "",
} as const;

const LOGICAL_PROPERTY_MAP: Record<string, string> = {
    top: "block-start",
    right: "inline-end",
    bottom: "block-end",
    left: "inline-start",
    x: "inline",
    y: "block",
} as const;

export function getDirectionAbbreviation(direction: DirectionalVariant): string {
    return DIRECTION_ABBREVIATIONS[direction];
}

export function getLogicalProperty(property: string, direction: DirectionalVariant): string {
    if (direction === "full" || direction === "all") return property;

    const logicalSuffix = LOGICAL_PROPERTY_MAP[direction];
    return logicalSuffix ? `${property}${DIRECTION_SEPARATOR}${logicalSuffix}` : property;
}

const ALL_DIRECTIONS: DirectionalVariant[] = ["top", "right", "bottom", "left", "x", "y", "full"];

function expandDirections(
    directions: DirectionalVariant[] | DirectionalVariant
): DirectionalVariant[] {
    const directionsArray = Array.isArray(directions) ? directions : [directions];
    return directionsArray.flatMap((direction) =>
        direction === "all" ? ALL_DIRECTIONS : [direction]
    );
}

function isTokenTypeValidForProperty(tokenType: TokenType, property: string): boolean {
    const propertyToTokenTypeMap: Record<string, TokenType[]> = {
        "color": ["color"],
        "background-color": ["color"],
        "border-color": ["color"],
        "font-size": ["dimension", "fluidDimension"],
        "font-weight": ["fontWeight"],
        "line-height": ["number"],
        "border-radius": ["dimension", "fluidDimension"],
        "border-width": ["dimension", "fluidDimension"],
        "padding": ["dimension", "fluidDimension"],
        "margin": ["dimension", "fluidDimension"],
        "width": ["dimension", "fluidDimension"],
        "height": ["dimension", "fluidDimension"],
        "gap": ["dimension", "fluidDimension"],
        "font-family": ["fontFamily"],
        "transition-duration": ["duration"],
        "transition-timing-function": ["cubicBezier"],
        "border-style": ["strokeStyle"],
        "box-shadow": ["shadow"],
        "text-shadow": ["shadow"],
        "background-image": ["gradient"],
        "opacity": ["number"],
    } as const;

    const validTypes = propertyToTokenTypeMap[property];
    if (!validTypes) {
        return true;
    }

    return validTypes.includes(tokenType);
}

// Cache for path-to-token maps to avoid rebuilding on every lookup
const pathIndexCache = new WeakMap<
    Record<string, ConvertedToken | NodeMetadata>,
    Map<string, ConvertedToken>
>();

// Cache for findMatchingToken results to avoid repeated lookups for the same class
// Key format: `${source}:${tokenName}` → token path or null
const matchCache = new Map<string, string[] | null>();

/**
 * Clears the token matching cache.
 * Call this when tokens change (e.g., on hot reload in dev mode).
 */
export function clearMatchCache(): void {
    matchCache.clear();
}

/**
 * We build a path-to-token index for O(1) lookups instead of O(n) iteration.
 */
function buildPathIndex(
    contextTokens: Record<string, ConvertedToken | NodeMetadata>
): Map<string, ConvertedToken> {
    const cached = pathIndexCache.get(contextTokens);
    if (cached) return cached;

    const index = new Map<string, ConvertedToken>();
    for (const tokenOrMetadata of Object.values(contextTokens)) {
        // Metadata, so skip it
        if (!("$path" in tokenOrMetadata)) continue;

        const token = tokenOrMetadata as ConvertedToken;
        index.set(token.$path, token);
    }

    pathIndexCache.set(contextTokens, index);
    return index;
}

/**
 * Gets the default context tokens from the normalized token structure.
 * In the resolver format, tokens are organized by context (e.g., "default", "dark", "ocean").
 * For utilities, we use the default context to find matching tokens.
 */
function getDefaultContextTokens(
    tokens: NormalizedConvertedTokens
): Record<string, ConvertedToken | NodeMetadata> | null {
    if (tokens.default) {
        return tokens.default as Record<string, ConvertedToken | NodeMetadata>;
    }

    // Fall back to the first context if "default" doesn't exist
    const contexts = Object.keys(tokens);
    if (contexts.length > 0 && contexts[0]) {
        return tokens[contexts[0]] as Record<string, ConvertedToken | NodeMetadata>;
    }

    return null;
}

export function findMatchingToken(
    tokenName: string,
    config: PropertyUtilityConfig & { property?: string },
    tokens: NormalizedConvertedTokens
): string[] | null {
    const cacheKey = `${config.source}:${config.prefix ?? ""}:${config.property ?? ""}:${tokenName}`;
    if (matchCache.has(cacheKey)) {
        return matchCache.get(cacheKey) ?? null;
    }

    // Replace * in source with the tokenName
    // Try two strategies:
    // 1. Keep hyphens as-is (for tokens like "color.bg-offset-1")
    // 2. Convert hyphens to dots (for nested tokens like "color.success.fill.solid")
    const searchPaths = [
        config.source.replace("*", tokenName),
        config.source.replace("*", tokenName.split("-").join(".")),
    ];

    // When stripDuplicates is enabled, users can write "text-muted" instead of "text-text-muted"
    // But the actual token might be at "color.text.muted" (with the prefix in the path).
    // So we also search for tokens where the prefix appears as a path segment, not just in the class name.
    // Example: config { source: "color.*", prefix: "text" }, class "text-muted" → searches "color.text.muted"
    if (config.stripDuplicates && config.prefix) {
        const wildcardIndex = config.source.lastIndexOf(".*");
        if (wildcardIndex !== -1) {
            const sourceBase = config.source.slice(0, wildcardIndex);
            if (sourceBase) {
                searchPaths.push(
                    `${sourceBase}.${config.prefix}.${tokenName}`,
                    `${sourceBase}.${config.prefix}.${tokenName.split("-").join(".")}`
                );
            }
        }
    }

    const defaultTokens = getDefaultContextTokens(tokens);
    if (!defaultTokens) {
        matchCache.set(cacheKey, null);
        return null;
    }

    const pathIndex = buildPathIndex(defaultTokens);

    for (const searchPath of searchPaths) {
        const token = pathIndex.get(searchPath);
        if (token) {
            if (config.property && token.$type) {
                if (!isTokenTypeValidForProperty(token.$type, config.property)) {
                    continue;
                }
            }

            const result = token.$path.split(".");
            matchCache.set(cacheKey, result);
            return result;
        }
    }

    matchCache.set(cacheKey, null);
    return null;
}

/**
 * Strips duplicate prefix from token name if stripDuplicates is enabled.
 * For example, "text-text-muted" with prefix "text" becomes "muted".
 */
function stripDuplicatePrefix(tokenName: string, config: PropertyUtilityConfig): string {
    if (config.stripDuplicates && config.prefix && tokenName.startsWith(`${config.prefix}-`)) {
        return tokenName.slice(config.prefix.length + 1);
    }
    return tokenName;
}

function createUtilityPattern(prefix?: string, directionAbbr = ""): RegExp {
    const prefixPart = prefix ?? "";
    const separator = prefixPart || directionAbbr ? DIRECTION_SEPARATOR : "";
    return new RegExp(`^${prefixPart}${directionAbbr}${separator}(.+)$`);
}

function createSimpleRule(
    property: string,
    config: PropertyUtilityConfig,
    tokens: NormalizedConvertedTokens
): [RegExp, (m: RegExpMatchArray) => CSSObject] {
    const pattern = createUtilityPattern(config.prefix);

    return [
        pattern,
        (match) => {
            const tokenName = match[1];
            if (!tokenName) return {};

            const processedTokenName = stripDuplicatePrefix(tokenName, config);
            const configWithProperty = { ...config, property };
            const tokenPath = findMatchingToken(processedTokenName, configWithProperty, tokens);
            if (!tokenPath) return {};
            return { [property]: `var(${CSS_VAR_PREFIX}${tokenPath.join(DIRECTION_SEPARATOR)})` };
        },
    ];
}

function createDirectionalRule(
    property: string,
    config: PropertyUtilityConfig,
    direction: DirectionalVariant,
    tokens: NormalizedConvertedTokens
): [RegExp, (m: RegExpMatchArray) => CSSObject] {
    if (direction === "all") {
        return createSimpleRule(property, config, tokens);
    }

    const directionAbbr = getDirectionAbbreviation(direction);
    const pattern = createUtilityPattern(config.prefix, directionAbbr);

    return [
        pattern,
        (match) => {
            const tokenName = match[1];
            if (!tokenName) return {};

            const processedTokenName = stripDuplicatePrefix(tokenName, config);
            const configWithProperty = { ...config, property };
            const tokenPath = findMatchingToken(processedTokenName, configWithProperty, tokens);
            if (!tokenPath) return {};
            const logicalProperty = getLogicalProperty(property, direction);
            return {
                [logicalProperty]: `var(${CSS_VAR_PREFIX}${tokenPath.join(DIRECTION_SEPARATOR)})`,
            };
        },
    ];
}

interface RuleForPrefix {
    property: string;
    config: PropertyUtilityConfig;
    direction: DirectionalVariant | null;
    tokens: NormalizedConvertedTokens;
}

function createSmartRule(
    prefix: string,
    rulesForPrefix: RuleForPrefix[]
): [RegExp, (m: RegExpMatchArray) => CSSObject] {
    const pattern = createUtilityPattern(prefix);

    return [
        pattern,
        (match) => {
            const tokenName = match[1];
            if (!tokenName) return {};

            for (const { property, config, direction, tokens } of rulesForPrefix) {
                const processedTokenName = stripDuplicatePrefix(tokenName, config);
                const configWithProperty = { ...config, property };
                const tokenPath = findMatchingToken(processedTokenName, configWithProperty, tokens);
                if (tokenPath) {
                    if (direction) {
                        const logicalProperty = getLogicalProperty(property, direction);
                        return {
                            [logicalProperty]: `var(${CSS_VAR_PREFIX}${tokenPath.join(DIRECTION_SEPARATOR)})`,
                        };
                    }
                    return {
                        [property]: `var(${CSS_VAR_PREFIX}${tokenPath.join(DIRECTION_SEPARATOR)})`,
                    };
                }
            }
            return {};
        },
    ];
}

function createDirectTokenPathRule(
    property: string,
    config: PropertyUtilityConfig,
    tokens: NormalizedConvertedTokens
): [RegExp, (m: RegExpMatchArray) => CSSObject] {
    // For utilities without prefix, use the first part of the source path as the pattern base
    // Extract the base path before the first dot (e.g., "text" from "text.*")
    // Token paths use dots as separators, so we split on the first dot
    const firstDotIndex = config.source.indexOf(".");
    const sourceBase = firstDotIndex !== -1 ? config.source.slice(0, firstDotIndex) : config.source;
    const pattern = createUtilityPattern(sourceBase);

    return [
        pattern,
        (match) => {
            const tokenName = match[1];
            if (!tokenName) return {};
            const configWithProperty = { ...config, property };
            const tokenPath = findMatchingToken(tokenName, configWithProperty, tokens);
            if (!tokenPath) return {};
            return { [property]: `var(${CSS_VAR_PREFIX}${tokenPath.join(DIRECTION_SEPARATOR)})` };
        },
    ];
}

function validateUtilityConfig(config: PropertyUtilityConfig, property: string): void {
    if (!config?.source || typeof config.source !== "string") {
        throw new Error(ErrorMessages.UTILITIES.MISSING_SOURCE(property));
    }
    // Validate that source pattern uses supported wildcard format (.* at the end)
    // Currently only supports patterns like "color.*", "font.weight.*", etc.
    if (config.source.includes("*") && !config.source.endsWith(".*")) {
        throw new Error(ErrorMessages.UTILITIES.INVALID_SOURCE_PATTERN(property, config.source));
    }
    if (config.directions && !Array.isArray(config.directions)) {
        throw new Error(ErrorMessages.UTILITIES.INVALID_DIRECTIONS(property));
    }
}

function validateInputs(utilitiesConfig: UtilitiesConfig, tokens: NormalizedConvertedTokens): void {
    if (!utilitiesConfig || typeof utilitiesConfig !== "object") {
        throw new Error(ErrorMessages.UTILITIES.INVALID_CONFIG_OBJECT);
    }
    if (!tokens || typeof tokens !== "object") {
        throw new Error(ErrorMessages.UTILITIES.INVALID_TOKENS_OBJECT);
    }
}

/**
 * Converts a utilities configuration into UnoCSS dynamic rules.
 *
 * @param utilitiesConfig - The utilities configuration from sugarcube.config
 * @param tokens - The converted tokens to generate rules for
 * @returns Array of UnoCSS dynamic rules [pattern, handler]
 */
export function convertConfigToUnoRules(
    utilitiesConfig: UtilitiesConfig,
    tokens: NormalizedConvertedTokens
): Array<[RegExp, (m: RegExpMatchArray) => CSSObject]> {
    validateInputs(utilitiesConfig, tokens);

    const rules: Array<[RegExp, (m: RegExpMatchArray) => CSSObject]> = [];
    const prefixGroups: Record<string, RuleForPrefix[]> = {};

    for (const [property, config] of Object.entries(utilitiesConfig)) {
        const configs = Array.isArray(config) ? config : [config];

        for (const singleConfig of configs) {
            validateUtilityConfig(singleConfig, property);

            if (singleConfig.prefix) {
                const prefix = singleConfig.prefix;
                if (!prefixGroups[prefix]) prefixGroups[prefix] = [];
                prefixGroups[prefix].push({
                    property,
                    config: singleConfig,
                    direction: null,
                    tokens,
                });
            } else {
                const rule = createDirectTokenPathRule(property, singleConfig, tokens);
                rules.push(rule);
            }
        }
    }

    for (const [prefix, rulesForPrefix] of Object.entries(prefixGroups)) {
        if (rulesForPrefix.length === 1) {
            const firstRule = rulesForPrefix[0];
            if (!firstRule) continue;
            const { property, config, tokens } = firstRule;
            if (config.directions) {
                const expandedDirections = expandDirections(config.directions);
                const directionsArray = Array.isArray(config.directions)
                    ? config.directions
                    : [config.directions];
                const hasAllDirection = directionsArray.includes("all");
                if (hasAllDirection) {
                    rules.push(createSimpleRule(property, config, tokens));
                }
                for (const direction of expandedDirections) {
                    if (!(EXCLUDED_DIRECTIONS as readonly string[]).includes(direction)) {
                        rules.push(createDirectionalRule(property, config, direction, tokens));
                    }
                }
            } else {
                rules.push(createSimpleRule(property, config, tokens));
            }
        } else {
            rules.push(createSmartRule(prefix, rulesForPrefix));
        }
    }

    return rules;
}
