import type { ZodIssue } from "zod";
import type { InternalConfig, SugarcubeConfig } from "../types/config.js";
import type { ConfigIssue } from "../types/diagnostics.js";
import { ConfigError } from "./config-error.js";
import { DEFAULT_CONFIG } from "./constants/config.js";
import { internalConfigSchema, userConfigSchema } from "./schemas/config.js";

// ============================================
// defineConfig — type-inferred config helper
// ============================================

/**
 * Define a sugarcube configuration with full type inference.
 *
 * @example
 * ```ts
 * // sugarcube.config.ts
 * import { defineConfig } from "@sugarcube-sh/cli";
 *
 * export default defineConfig({
 *   resolver: "./tokens/resolver.json",
 *   variables: { path: "src/styles/tokens.css" }
 * });
 * ```
 */
export function defineConfig(config: SugarcubeConfig): SugarcubeConfig {
    return config;
}

// ============================================
// fillDefaultsCore — environment-agnostic defaults
// ============================================

/**
 * Default directories for path defaults. Callers in non-Node environments
 * (browser, edge, workers) construct one of these manually instead of
 * relying on filesystem detection.
 */
export type DefaultDirs = {
    /** Directory used for default `variables.path` and `utilities.path`, and `cube` */
    stylesDir: string;
    /** Directory used for default `components` */
    componentsDir: string;
};

/**
 * Pure, environment-agnostic version of `fillDefaults`. Takes the default
 * directories explicitly instead of detecting them from the filesystem,
 * making this safe to use in browsers, workers, edge functions, etc.
 *
 * The Node-coupled `fillDefaults` (in `node/config/normalize.ts`) is a thin
 * wrapper around this function that handles `src/` detection via `existsSync`.
 */
export function fillDefaultsCore(userConfig: SugarcubeConfig, dirs: DefaultDirs): InternalConfig {
    const { stylesDir, componentsDir } = dirs;

    const defaultVariablesPath = `${stylesDir}/${DEFAULT_CONFIG.variables.filename}`;
    const defaultUtilitiesPath = `${stylesDir}/${DEFAULT_CONFIG.utilities.filename}`;

    const internalConfig: InternalConfig = {
        resolver: userConfig.resolver,

        variables: {
            path: userConfig.variables?.path ?? defaultVariablesPath,
            prefix: userConfig.variables?.prefix,
            variableName: userConfig.variables?.variableName,
            layer: userConfig.variables?.layer,
            transforms: {
                fluid:
                    userConfig.variables?.transforms?.fluid ??
                    DEFAULT_CONFIG.variables.transforms.fluid,
                colorFallbackStrategy:
                    userConfig.variables?.transforms?.colorFallbackStrategy ??
                    DEFAULT_CONFIG.variables.transforms.colorFallbackStrategy,
            },
            permutations: userConfig.variables?.permutations,
            redeclareDependents: userConfig.variables?.redeclareDependents,
            propagateDependents: userConfig.variables?.propagateDependents,
        },

        utilities: {
            path: userConfig.utilities?.path ?? defaultUtilitiesPath,
            layer: userConfig.utilities?.layer,
            classes: userConfig.utilities?.classes,
        },

        content: userConfig.content,

        components: userConfig.components ?? componentsDir,

        cube: userConfig.cube ?? stylesDir,

        studio: userConfig.studio,
    };

    return internalConfig;
}

// ============================================
// Validators
// ============================================

/**
 * Validates a user configuration object against the user schema.
 *
 * @param config - The user configuration object to validate
 * @returns The validated user configuration
 * @throws ConfigError if the configuration is invalid
 */
export function validateSugarcubeConfig(config: unknown): SugarcubeConfig {
    const userResult = userConfigSchema.safeParse(config);
    if (!userResult.success) throw new ConfigError(userResult.error.issues.flatMap(issuesOf));
    return userResult.data;
}

/**
 * Validates an internal configuration object against the internal schema.
 *
 * @param config - The internal configuration object to validate
 * @returns The validated internal configuration
 * @throws ConfigError if the configuration is invalid
 */
export function validateInternalConfig(config: unknown): InternalConfig {
    const internalResult = internalConfigSchema.safeParse(config);
    if (!internalResult.success)
        throw new ConfigError(internalResult.error.issues.flatMap(issuesOf));
    return internalResult.data;
}

/**
 * Validates a user configuration object against the schema and fills in defaults.
 *
 * Environment-agnostic. Pure — takes the default directories explicitly. For
 * Node callers that want `src/` detection, use `validateConfigWithDefaults`
 * from the Node entry (or pass `DEFAULT_DIRS` manually).
 *
 * @param config - The user configuration object to validate
 * @param dirs - Default directories to use when filling defaults
 * @returns The validated configuration with defaults filled in
 * @throws Error if the configuration is invalid
 */
export function validateConfig(
    config: Partial<SugarcubeConfig>,
    dirs: DefaultDirs,
): InternalConfig {
    const userConfig = validateSugarcubeConfig(config);
    const internalConfig = fillDefaultsCore(userConfig, dirs);
    return validateInternalConfig(internalConfig);
}

type TypeIssue = Extract<ZodIssue, { code: "invalid_type" }>;
type UnionIssue = Extract<ZodIssue, { code: "invalid_union" }>;

function issuesOf(issue: ZodIssue): ConfigIssue[] {
    const setting = issue.path.join(".");
    if (issue.code === "invalid_union") return unionIssues(issue, setting);
    if (issue.code === "invalid_enum_value") {
        return [{ reason: "not-allowed", setting, allowed: issue.options, value: issue.received }];
    }
    if (issue.code === "invalid_type")
        return typeIssues(issue.path, [issue.expected], issue.received);
    return [{ reason: "invalid", setting, message: issue.message }];
}

function typeIssues(
    path: (string | number)[],
    expected: string[],
    received: string,
): ConfigIssue[] {
    const property = path.at(-1);
    if (received === "undefined" && typeof property === "string") {
        return [{ reason: "missing", setting: path.slice(0, -1).join("."), property }];
    }
    return [{ reason: "wrong-type", setting: path.join("."), expected, received }];
}

function unionIssues(issue: UnionIssue, setting: string): ConfigIssue[] {
    const branches = issue.unionErrors.map(({ issues }) => issues);
    const ownType = (issues: ZodIssue[]) =>
        issues.find(
            (each): each is TypeIssue =>
                each.code === "invalid_type" && each.path.join(".") === setting,
        );
    const meant = branches.find((issues) => !ownType(issues));
    if (meant) return meant.flatMap(issuesOf);
    const types = branches.flatMap((issues) => ownType(issues) ?? []);
    const received = types[0]?.received ?? "undefined";
    return typeIssues(issue.path, [...new Set(types.map(({ expected }) => expected))], received);
}
