import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createJiti } from "jiti";
import { basename, dirname, relative, resolve } from "pathe";
import { isObject } from "../../shared/checks.js";
import { validateSugarcubeConfig } from "../../shared/config.js";
import { ConfigError } from "../../shared/config-error.js";
import type { InternalConfig, SugarcubeConfig } from "../../types/config.js";
import { findResolver } from "@sugarcube-sh/dtcg/node";
import { fillDefaults } from "./normalize.js";

export function isNoConfigError(error: unknown): boolean {
    return (
        error instanceof ConfigError && error.issues.some(({ reason }) => reason === "no-resolver")
    );
}

function resolveContentGlobs(
    content: readonly string[] | undefined,
    baseDir: string,
): string[] | undefined {
    if (!content) return content;
    return content.map((glob) =>
        glob.startsWith("!") ? `!${resolve(baseDir, glob.slice(1))}` : resolve(baseDir, glob),
    );
}

/**
 * A checked config with its defaults, and the file it came from.
 *
 * `config.resolver` is always set. It's the config's own, or the one found in the project.
 */
export type LoadedConfig = {
    config: InternalConfig & { readonly resolver: string };
    /** The config file it came from, when there is one. */
    configFile?: string;
};

/**
 * Settings that replace the config's, such as a command's flags.
 *
 * Any setting can be replaced, at any depth. An array replaces the config's whole array.
 * A setting left `undefined` keeps the config's.
 */
export type ConfigOverrides = Overrides<SugarcubeConfig>;

type Overrides<T> = {
    [K in keyof T]?: NonNullable<T[K]> extends readonly unknown[] | ((...args: never[]) => unknown)
        ? T[K]
        : NonNullable<T[K]> extends object
          ? Overrides<NonNullable<T[K]>>
          : T[K];
};

function getConfigFilePaths(root: string): string[] {
    return [".ts", ".js"].map((extension) => resolve(root, `sugarcube.config${extension}`));
}

function findConfigFile(root = process.cwd()): string | undefined {
    return getConfigFilePaths(root).find((path) => existsSync(path));
}

/**
 * Checks if a file is the project's config file.
 *
 * The config file is `sugarcube.config.ts` or `sugarcube.config.js` in `root`.
 *
 * @param file - The file's path, such as `"/site/sugarcube.config.ts"`.
 * @param root - The project's folder, such as `"/site"`.
 *
 * @example
 * isConfigFile("/site/sugarcube.config.ts", "/site")
 * // => true
 */
export function isConfigFile(file: string, root: string): boolean {
    return getConfigFilePaths(root).includes(resolve(file));
}

/**
 * Checks if `sugarcube.config.ts` or `.js` exists in the current folder.
 */
export function configFileExists(): boolean {
    return findConfigFile() !== undefined;
}

async function loadConfigFile(configFile: string): Promise<unknown> {
    const exported = await importConfigFile(configFile);
    if (exported === undefined) {
        throw new ConfigError([{ reason: "exports-nothing", file: basename(configFile) }]);
    }
    return exported;
}

async function importConfigFile(configFile: string): Promise<unknown> {
    try {
        const jiti = createJiti(import.meta.url, {
            interopDefault: true,
            moduleCache: false,
        });
        const result = await jiti.evalModule(await readFile(configFile, "utf8"), {
            filename: configFile,
            async: true,
            forceTranspile: true,
        });
        if (result && typeof result === "object" && "default" in result) return result.default;
        return isObject(result) && Object.keys(result).length === 0 ? undefined : result;
    } catch (error) {
        const thrown = error instanceof Error ? error.message : String(error);
        const cause = thrown.replace(/\s+/g, " ").trim();
        const file = basename(configFile);
        throw new ConfigError([{ reason: "not-loaded", file, cause }], { cause: error });
    }
}

/**
 * Loads the project's config, checks it and fills in its defaults.
 *
 * With no config file, every setting is a default. With no `resolver`, it finds the project's only
 * resolver file. Then `overrides` replace the settings they name.
 *
 * @param overrides - Settings that replace the config's, such as `{ variables: { prefix: "ds" } }`.
 * @param options.root - The project's folder, such as `"/site"`. Paths in the config are relative to it.
 * @param options.lastConfigFile - The config file loaded last, such as `"/site/sugarcube.config.ts"`.
 * Pass it when loading again, so a deleted config file is an error.
 * @throws ConfigError if the config has mistakes, was deleted, or names no single resolver.
 *
 * @example
 * const { config, configFile } = await loadInternalConfig();
 * config.utilities.path
 * // => "src/styles/utilities.css"
 */
export async function loadInternalConfig(
    overrides: ConfigOverrides = {},
    { root = process.cwd(), lastConfigFile }: { root?: string; lastConfigFile?: string } = {},
): Promise<LoadedConfig> {
    const configFile = findConfigFile(root);
    if (lastConfigFile !== undefined && configFile === undefined) {
        throw new ConfigError([{ reason: "deleted", file: basename(lastConfigFile) }]);
    }
    const userConfig = configFile ? validateSugarcubeConfig(await loadConfigFile(configFile)) : {};
    const resolver = overrides.resolver ?? userConfig.resolver ?? (await findResolverPath(root));
    const withDefaults = fillDefaults({ ...userConfig, resolver });
    const content = configFile
        ? resolveContentGlobs(withDefaults.content, dirname(configFile))
        : withDefaults.content;
    const config = applyOverrides<InternalConfig>({ ...withDefaults, content }, overrides);
    validateSugarcubeConfig(config);
    return { config: { ...config, resolver }, configFile };
}

async function findResolverPath(root: string): Promise<string> {
    const found = await findResolver(root);
    if (found.kind === "one") return relative(root, found.path);
    if (found.kind === "several") {
        const paths = found.paths.map((path) => relative(root, path));
        throw new ConfigError([{ reason: "several-resolvers", paths }]);
    }
    throw new ConfigError([{ reason: "no-resolver" }]);
}

function applyOverrides<T>(base: T, overrides: Overrides<T>): T {
    return mergeDeep(base, overrides) as T;
}

function mergeDeep(base: unknown, overrides: unknown): unknown {
    if (overrides === undefined) return base;
    if (!isObject(base) || !isObject(overrides)) return overrides;
    const result: Record<string, unknown> = { ...base };
    for (const [key, value] of Object.entries(overrides)) result[key] = mergeDeep(base[key], value);
    return result;
}
