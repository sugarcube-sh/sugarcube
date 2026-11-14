import { pluralize } from "@sugarcube-sh/core";
import color from "picocolors";
import { COMMANDS } from "./commands.js";
import { LINKS } from "./links.js";
import type { UnreadStylesheets } from "../scan-stylesheets.js";

const formatUnreadHeadline = (entries: UnreadStylesheets[]) => {
    const [first] = entries;
    if (entries.length === 1 && first) {
        return `Didn't read ${pluralize(first.count, "stylesheet")} in ${color.cyan(first.dir)}`;
    }

    const total = entries.reduce((sum, entry) => sum + entry.count, 0);
    const list = entries.map(({ dir, count }) => `  ${count} in ${color.cyan(dir)}`).join("\n");
    return `Didn't read ${pluralize(total, "stylesheet")}:\n\n${list}`;
};

const formatUnreadFix = (entries: UnreadStylesheets[]) =>
    `Add the ${entries.length === 1 ? "folder" : "folders"} to ${color.cyan("content")}.`;

const formatNoStylesheetsHelp = (cwd: string, also = "") =>
    `Looked below ${color.cyan(cwd)} and in your ${color.cyan("content")} globs.\nIf your CSS lives elsewhere, add it to ${color.cyan("content")}:\n\n  content: ["../css/**/*.css"]\n\n${also}See ${color.cyan(LINKS.CONFIGURATION)} for more information.`;

const formatCause = (error: unknown) => (error instanceof Error ? `: ${error.message}` : "");

export const ErrorMessages = {
    MARKUP_TOO_MANY_FILES: (count: number, limit: number) =>
        `Found ${count} files to scan (limit: ${limit}). Are you running this from a monorepo root or a directory containing multiple projects? Run the command from within a single project directory instead.`,

    MARKUP_TOO_LARGE: (limitMB: number) =>
        `Total source size exceeds ${limitMB}MB. Are you running this from a monorepo root or a directory containing multiple projects? Run the command from within a single project directory instead.`,

    WATCH_MANY_MARKUP_FILES: (count: number, limit: number) =>
        `Watching ${count} files for markup changes (limit: ${limit}). This can make watch mode slow. Set \`content\` in your config to narrow the directories that are scanned.`,

    COMPONENT_NOT_FOUND: (name: string, available: string[]) =>
        `Component '${name}' not found in registry\nAvailable components: ${available.join(", ")}`,

    COMPONENT_WRITE_FAILED: (name: string, error: unknown) =>
        `Failed to write component file for "${name}"${formatCause(error)}`,

    CUBE_PATH_ESCAPES: (module: string) =>
        `Invalid file path detected in CUBE module "${module}": path escapes target directory`,

    CUBE_WRITE_FAILED: (module: string, error: unknown) =>
        `Failed to write CUBE module "${module}"${formatCause(error)}`,

    OUTPUT_DIR_CREATE_FAILED: (error: unknown) =>
        `Failed to create output directory${formatCause(error)}`,

    FILES_WILL_BE_OVERWRITTEN: (kind: "component" | "cube", files: string[]) =>
        `The following file(s) already exist and will be overwritten:\n\n${kind === "component" ? "Component files" : "CUBE CSS files"}:\n${files.map((file) => `  - ${file}`).join("\n")}`,

    CONFIG_EXISTS: () =>
        `A sugarcube config file already exists in this project.\n\nTo start over, remove it and run ${color.cyan(COMMANDS.INIT)} again.`,

    REGISTRY_AUTH_REQUIRED: (url: string) =>
        `Registry access denied: Authentication required\nURL: ${color.cyan(url)}`,

    REGISTRY_AUTH_INVALID: (url: string) =>
        `Registry access denied: Invalid or missing token\nURL: ${color.cyan(url)}`,

    REGISTRY_NOT_FOUND: (url: string) => `Registry resource not found\nURL: ${color.cyan(url)}`,

    REGISTRY_REQUEST_FAILED: (message: string, url: string) =>
        `Registry request failed: ${message}\nURL: ${color.cyan(url)}`,

    REGISTRY_NETWORK_ERROR: (url: string) =>
        `Failed to connect to registry\n\nURL: ${color.cyan(url)}\n\nThe registry server may be temporarily unavailable or there might be network connectivity issues. Please try again in a few minutes.`,

    REGISTRY_INVALID_DATA: (url: string) =>
        `Invalid registry data received\nURL: ${color.cyan(url)}`,

    REGISTRY_ITEM_NOT_FOUND: (type: string, name: string, availableItems: string[]) =>
        `${type === "tokens" ? "Starter kit" : type}'${color.cyan(name)} ' not found in registry\nAvailable ${type === "tokens" ? "starter kit" : type}s: ${availableItems.join(", ")}`,

    REGISTRY_FILE_INVALID: (filePath: string) =>
        `Invalid file content received\nFile: ${color.cyan(filePath)}`,

    STARTER_KIT_UNAVAILABLE: (kitChoice: string) =>
        `Starter kit '${color.cyan(kitChoice)}' is currently unavailable.\n\nPlease try a different starter kit or run the command again in a few minutes.`,

    NO_TOKENS_FOR_COMMAND: (command: string) =>
        `No design tokens found.\n\n${color.cyan(
            `sugarcube ${command}`,
        )} needs your tokens to know which variables exist. Run it from a project with a sugarcube config or a discoverable ${color.cyan(
            "*.resolver.json",
        )}, or run ${color.cyan("@sugarcube-sh/cli init")} to set one up.\n\nSee ${color.cyan(
            LINKS.RESOLVER,
        )} for more information.`,

    DEPENDENCY_INSTALL_FAILED: (packageManager: string, stderr?: string) => {
        const base = `Failed to install dependencies using ${packageManager}.\nPlease check your package manager configuration and try again.`;
        if (!stderr) return base;
        return `${base}\n\n${color.dim(`${packageManager} output:`)}\n${stderr}`;
    },

    VALIDATE_SEVERAL_RESOLVERS: (paths: string[]) =>
        `Several resolver files were found:\n${paths.map((p) => `  - ${p}`).join("\n")}\n\nValidate one at a time, such as: ${color.cyan(`sugarcube validate ${paths[0]}`)}`,

    VALIDATE_NO_RESOLVER: (paths: string[]) =>
        `Several token files need a resolver to be read together:\n${paths.map((p) => `  - ${p}`).join("\n")}\n\nSee ${color.cyan(LINKS.RESOLVER)} for more information.`,

    VALIDATE_PATH_NOT_FOUND: (path: string) =>
        `Path not found: ${path}\n\nPlease check that the specified path exists`,

    VALIDATE_NO_TOKEN_FILES: (otherFiles: string[]) =>
        otherFiles.length === 0
            ? "No token files found.\n\nToken files end .json or .tokens."
            : `No token files found. These JSON files use no DTCG property, such as $value or $type:\n${otherFiles.map((p) => `  - ${p}`).join("\n")}`,

    COMPONENTS_FRAMEWORK_REQUIRED: (frameworks: readonly string[]) =>
        `Framework is required when specifying components. Use --framework to specify a framework (${frameworks.join(", ")}) or run without arguments for interactive mode.\n\nSee ${color.cyan(
            LINKS.COMPONENTS_CLI,
        )} for more information.`,

    COMPONENTS_INVALID_FRAMEWORK: (frameworks: readonly string[]) =>
        `Invalid framework. Must be one of: ${frameworks.join(", ")}.`,

    LINT_NO_FILES_SCANNED: (cwd: string) =>
        `No stylesheets found, so nothing was linted.\n\n${formatNoStylesheetsHelp(cwd, `Or name it for one run: ${color.cyan("sugarcube lint ../css")}\n\n`)}`,

    ANALYZE_UNUSED_NO_FILES_SCANNED: (cwd: string) =>
        `No stylesheets found. Tokens reached only through your CSS are listed as unused below.\n\n${formatNoStylesheetsHelp(cwd)}`,

    ANALYZE_IMPACT_NO_FILES_SCANNED: (cwd: string) =>
        `No stylesheets found, so no CSS consumers of this token can be listed.\n\n${formatNoStylesheetsHelp(cwd)}`,

    LINT_UNREAD_STYLESHEETS: (entries: UnreadStylesheets[]) =>
        `${formatUnreadHeadline(entries)}\n\nThose files weren't checked. ${formatUnreadFix(entries)}\n\n${color.cyan(LINKS.CONFIGURATION)}`,

    ANALYZE_UNREAD_STYLESHEETS: (entries: UnreadStylesheets[]) =>
        `${formatUnreadHeadline(entries)}\n\nTokens used only there appear unused. ${formatUnreadFix(entries)}\n\n${color.cyan(LINKS.CONFIGURATION)}`,

    NO_CSS_WRITTEN: () => "No CSS was written.",
    NO_CSS_TO_WRITE: () => "No CSS to write.",

    NOTHING_ANALYSED: () => "Nothing was analysed.",

    NOTHING_LINTED: () => "Nothing was linted.",

    ANALYZE_NO_TOKEN: (path: string) => `No token "${path}" in this system.`,

    ANALYZE_GROUP_NOT_TOKEN: (path: string) => `\`${path}\` is a group; impact takes one token.`,
} as const;
