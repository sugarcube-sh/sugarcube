import { existsSync } from "node:fs";
import { createJiti } from "jiti";
import { basename, dirname, resolve } from "pathe";
import { validateInternalConfig, validateSugarcubeConfig } from "../../shared/config.js";
import { ConfigError } from "../../shared/config-error.js";
import { ErrorMessages } from "../../shared/constants/error-messages.js";
import type { InternalConfig, SugarcubeConfig } from "../../types/config.js";
import { findResolverDocument } from "../resolver/find.js";
import { fillDefaults } from "./normalize.js";

export function isNoConfigError(error: unknown): boolean {
    return error instanceof Error && error.message === ErrorMessages.CONFIG.NO_CONFIG_OR_RESOLVER();
}

function resolveContentGlobs(content: string[] | undefined, baseDir: string): string[] | undefined {
    if (!content) return content;
    return content.map((glob) =>
        glob.startsWith("!") ? `!${resolve(baseDir, glob.slice(1))}` : resolve(baseDir, glob),
    );
}

/**
 * A sugarcube configuration, validated and with defaults applied, with the resolver it reads
 * always named: the config's own, or the one found in the project.
 */
export type LoadedConfig = {
    config: InternalConfig & { resolver: string };
    /** The config file it came from, when there is one. */
    configFile?: string;
};

/**
 * Settings to put over the config's, such as a command's flags: any of them, at any depth. A list
 * replaces the config's whole list, and a setting left `undefined` keeps the config's.
 */
export type ConfigOverrides = Overrides<SugarcubeConfig>;

type Overrides<T> = {
    [K in keyof T]?: NonNullable<T[K]> extends readonly unknown[] | ((...args: never[]) => unknown)
        ? T[K]
        : NonNullable<T[K]> extends object
          ? Overrides<NonNullable<T[K]>>
          : T[K];
};

function findConfigFile(): string | undefined {
    return [".ts", ".js"]
        .map((extension) => resolve(process.cwd(), `sugarcube.config${extension}`))
        .find((path) => existsSync(path));
}

/**
 * Checks if `sugarcube.config.ts` or `.js` exists in the current folder.
 */
export function configFileExists(): boolean {
    return findConfigFile() !== undefined;
}

async function loadConfigFile(configFile: string): Promise<unknown> {
    try {
        const jiti = createJiti(import.meta.url, {
            interopDefault: true,
            moduleCache: false,
        });
        const result = await jiti.import(configFile);
        return result && typeof result === "object" && "default" in result
            ? result.default
            : result;
    } catch (error) {
        if (!(error instanceof Error)) throw error;
        const cause = error.message.replace(/\s+/g, " ").trim();
        const file = basename(configFile);
        throw new ConfigError([{ reason: "not-loaded", file, cause }], { cause: error });
    }
}

/**
 * Loads `sugarcube.config.ts` or `.js` from the current folder, when there is one, validates it
 * and fills in its defaults; finds the resolver when nothing names one; then puts `overrides` on
 * top and validates the result.
 *
 * @param overrides - Settings over the config's, such as a command's flags; a `resolver` here is
 * read without looking for one
 * @returns The normalized config with defaults, and the config file it came from, if any
 * @throws ConfigError if the config is invalid, or if no resolver, or several, are found
 */
export async function loadInternalConfig(overrides: ConfigOverrides = {}): Promise<LoadedConfig> {
    const configFile = findConfigFile();
    const user = configFile ? validateSugarcubeConfig(await loadConfigFile(configFile)) : {};
    const resolver = overrides.resolver ?? user.resolver ?? (await foundResolver());
    const filled = fillDefaults({ ...user, resolver });
    if (configFile) filled.content = resolveContentGlobs(filled.content, dirname(configFile));
    const config = validateInternalConfig(overridden(filled, overrides));
    return { config: { ...config, resolver }, configFile };
}

async function foundResolver(): Promise<string> {
    const discovery = await findResolverDocument(process.cwd());
    if (discovery.found === "one") return discovery.path;
    if (discovery.found === "multiple") {
        throw new ConfigError(ErrorMessages.CONFIG.MULTIPLE_RESOLVERS_FOUND(discovery.paths));
    }
    throw new ConfigError(ErrorMessages.CONFIG.NO_CONFIG_OR_RESOLVER());
}

function overridden(base: unknown, overrides: unknown): unknown {
    if (overrides === undefined) return base;
    if (!isPlainObject(base) || !isPlainObject(overrides)) return overrides;
    const merged: Record<string, unknown> = { ...base };
    for (const [key, value] of Object.entries(overrides))
        merged[key] = overridden(base[key], value);
    return merged;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}
