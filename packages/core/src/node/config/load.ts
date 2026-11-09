import { existsSync } from "node:fs";
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
 * A sugarcube configuration, validated and with defaults applied, with the resolver it reads
 * always named: the config's own, or the one found in the project.
 */
export type LoadedConfig = {
    config: InternalConfig & { readonly resolver: string };
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

function configFilesIn(root: string): string[] {
    return [".ts", ".js"].map((extension) => resolve(root, `sugarcube.config${extension}`));
}

function findConfigFile(root = process.cwd()): string | undefined {
    return configFilesIn(root).find((path) => existsSync(path));
}

/**
 * Checks if a file is where sugarcube looks for its config: `sugarcube.config.ts` or `.js` in
 * `root`.
 *
 * @param file - The file's path, such as one a watcher reports.
 * @param root - The project's folder.
 */
export function isConfigFile(file: string, root: string): boolean {
    return configFilesIn(root).includes(resolve(file));
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
        const result = await jiti.import(configFile);
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
 * Loads `sugarcube.config.ts` or `.js` from the project's folder, when there is one, validates it
 * and fills in its defaults; finds the resolver when nothing names one; then puts `overrides` on
 * top and validates the result.
 *
 * @param overrides - Settings over the config's, such as a command's flags; a `resolver` here is
 * read without looking for one
 * @param root - The project's folder, where the config file and the resolver are looked for and
 * what the config's paths are relative to; `process.cwd()` unless a host such as Vite knows better
 * @param lastConfigFile - The config file a host loaded last, when it loads again; if no config
 * file is there now, the load fails rather than giving the defaults
 * @returns The normalized config with defaults, and the config file it came from, if any
 * @throws ConfigError if the config is invalid or was deleted, or if no resolver, or several, are
 * found
 */
export async function loadInternalConfig(
    overrides: ConfigOverrides = {},
    { root = process.cwd(), lastConfigFile }: { root?: string; lastConfigFile?: string } = {},
): Promise<LoadedConfig> {
    const configFile = findConfigFile(root);
    if (lastConfigFile !== undefined && configFile === undefined) {
        throw new ConfigError([{ reason: "deleted", file: basename(lastConfigFile) }]);
    }
    const user = configFile ? validateSugarcubeConfig(await loadConfigFile(configFile)) : {};
    const resolver = overrides.resolver ?? user.resolver ?? (await foundResolver(root));
    const filled = fillDefaults({ ...user, resolver });
    const content = configFile
        ? resolveContentGlobs(filled.content, dirname(configFile))
        : filled.content;
    const config = overridden<InternalConfig>({ ...filled, content }, overrides);
    validateSugarcubeConfig(config);
    return { config: { ...config, resolver }, configFile };
}

async function foundResolver(root: string): Promise<string> {
    const found = await findResolver(root);
    if (found.kind === "one") return relative(root, found.path);
    if (found.kind === "several") {
        const paths = found.paths.map((path) => relative(root, path));
        throw new ConfigError([{ reason: "several-resolvers", paths }]);
    }
    throw new ConfigError([{ reason: "no-resolver" }]);
}

function overridden<T>(base: T, overrides: Overrides<T>): T {
    return merged(base, overrides) as T;
}

function merged(base: unknown, overrides: unknown): unknown {
    if (overrides === undefined) return base;
    if (!isObject(base) || !isObject(overrides)) return overrides;
    const result: Record<string, unknown> = { ...base };
    for (const [key, value] of Object.entries(overrides)) result[key] = merged(base[key], value);
    return result;
}
