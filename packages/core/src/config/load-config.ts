import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "pathe";
import { ErrorMessages } from "../constants/error-messages.js";
import type { InternalConfig, SugarcubeConfig } from "../types/config.js";
import { findResolverDocument } from "../utils/find-resolver.js";
import { fillDefaults } from "./normalize-config.js";
import { validateInternalConfig, validateSugarcubeConfig } from "./validate-config.js";

export function isNoConfigError(error: unknown): boolean {
    return error instanceof Error && error.message === ErrorMessages.CONFIG.NO_CONFIG_OR_RESOLVER();
}

/**
 * Result of loading a sugarcube configuration file.
 * Contains the validated, normalized configuration and its source path.
 */
type LoadedConfig = {
    /** The validated and normalized configuration with defaults applied. */
    config: InternalConfig;
    /** The absolute path to the config file that was loaded, or the resolver path if auto-discovered. */
    configPath: string;
};

function findConfigFile(basePath = "sugarcube.config"): string | null {
    const extensions = [".ts", ".js"];
    const cwd = process.cwd();

    for (const ext of extensions) {
        const fullPath = resolve(cwd, `${basePath}${ext}`);
        if (existsSync(fullPath)) {
            return fullPath;
        }
    }
    return null;
}

/**
 * Checks if a sugarcube configuration file exists.
 *
 * @param basePath - Base path without extension (default: "sugarcube.config")
 * @returns True if a .ts or .js config file exists
 */
export function configFileExists(basePath = "sugarcube.config"): boolean {
    return findConfigFile(basePath) !== null;
}

async function loadTSConfig(configPath: string): Promise<unknown> {
    try {
        // Check if we're running in Bun (which has native TypeScript support)
        // Use globalThis to avoid TypeScript errors about Bun types
        const isBun = typeof (globalThis as { Bun?: unknown }).Bun !== "undefined";

        if (isBun) {
            // Bun has native TypeScript support
            const fileUrl = pathToFileURL(configPath).href;
            const dynamicImport = new Function("url", "return import(url)");
            const result = await dynamicImport(fileUrl);

            if (result && typeof result === "object" && "default" in result) {
                return result.default;
            }

            throw new Error(
                ErrorMessages.CONFIG.INVALID_CONFIG(
                    "root",
                    "Config file must export a default object"
                )
            );
        }

        const { createJiti } = await import("jiti");
        const jiti = createJiti(import.meta.url, {
            interopDefault: true,
        });

        const result = await jiti.import(configPath);

        if (result && typeof result === "object" && "default" in result) {
            return (result as { default: unknown }).default;
        }

        return result;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(ErrorMessages.CONFIG.INVALID_CONFIG("root", error.message));
        }
        throw error;
    }
}

async function loadConfigFile(configPath: string): Promise<unknown> {
    const isTSOrJS = configPath.endsWith(".ts") || configPath.endsWith(".js");

    if (isTSOrJS) {
        return await loadTSConfig(configPath);
    }

    const content = await fs.readFile(configPath, "utf-8");
    return JSON.parse(content);
}

function resolveConfigPath(configPath?: string): string {
    if (configPath) {
        return resolve(process.cwd(), configPath);
    }

    const found = findConfigFile();
    if (!found) {
        throw new Error(ErrorMessages.CONFIG.FILE_NOT_FOUND("sugarcube.config.ts"));
    }

    return found;
}

/**
 * Loads and validates a sugarcube configuration file.
 * Returns the user-facing config without internal defaults applied.
 *
 * @param configPath - Optional path to config file. If omitted, searches for sugarcube.config.ts/js
 * @returns The validated config and its resolved path
 * @throws Error if config file not found or invalid
 */
export async function loadSugarcubeConfig(configPath?: string): Promise<{
    config: SugarcubeConfig;
    configPath: string;
}> {
    const actualPath = resolveConfigPath(configPath);

    try {
        const configObject = await loadConfigFile(actualPath);
        const validatedConfig = validateSugarcubeConfig(configObject as Partial<SugarcubeConfig>);

        return {
            config: validatedConfig,
            configPath: actualPath,
        };
    } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "ENOENT") {
            throw new Error(ErrorMessages.CONFIG.FILE_NOT_FOUND(actualPath));
        }

        if (error instanceof SyntaxError) {
            throw new Error(ErrorMessages.CONFIG.INVALID_JSON(error.message));
        }

        throw error;
    }
}

/**
 * Loads, validates, and normalizes a sugarcube configuration file.
 * Returns a complete internal config with all defaults applied.
 *
 * If no config file is found, attempts to auto-discover a resolver file and use defaults.
 *
 * @param configPath - Optional path to config file. If omitted, searches for sugarcube.config.ts/js
 * @returns The normalized config with defaults, its resolved path, and source type
 * @throws Error if config file not found, invalid, or if multiple resolvers are discovered
 */
export async function loadInternalConfig(configPath?: string): Promise<LoadedConfig> {
    // Try to find a config file
    const foundConfigPath = configPath ? resolve(process.cwd(), configPath) : findConfigFile();

    if (foundConfigPath) {
        try {
            const configObject = await loadConfigFile(foundConfigPath);
            const userConfig = validateSugarcubeConfig(configObject as Partial<SugarcubeConfig>);

            // If config has no resolver, try auto-discovery
            if (!userConfig.resolver) {
                const discovery = await findResolverDocument(process.cwd());

                if (discovery.found === "one") {
                    userConfig.resolver = discovery.path;
                } else if (discovery.found === "multiple") {
                    throw new Error(ErrorMessages.CONFIG.MULTIPLE_RESOLVERS_FOUND(discovery.paths));
                } else if (discovery.found === "none") {
                    throw new Error(ErrorMessages.CONFIG.NO_CONFIG_OR_RESOLVER());
                }
            }

            const internalConfig = fillDefaults(userConfig);
            const validatedConfig = validateInternalConfig(internalConfig);

            return {
                config: validatedConfig,
                configPath: foundConfigPath,
            };
        } catch (error) {
            if (error instanceof Error && "code" in error && error.code === "ENOENT") {
                throw new Error(ErrorMessages.CONFIG.FILE_NOT_FOUND(foundConfigPath));
            }

            if (error instanceof SyntaxError) {
                throw new Error(ErrorMessages.CONFIG.INVALID_JSON(error.message));
            }

            throw error;
        }
    }

    // No config file - try to auto-discover a resolver file
    const discovery = await findResolverDocument(process.cwd());

    if (discovery.found === "one") {
        const minimalConfig: SugarcubeConfig = {
            resolver: discovery.path,
        };
        const internalConfig = fillDefaults(minimalConfig);
        const validatedConfig = validateInternalConfig(internalConfig);

        return {
            config: validatedConfig,
            configPath: discovery.path,
        };
    }

    if (discovery.found === "multiple") {
        throw new Error(ErrorMessages.CONFIG.MULTIPLE_RESOLVERS_FOUND(discovery.paths));
    }

    throw new Error(ErrorMessages.CONFIG.NO_CONFIG_OR_RESOLVER());
}
