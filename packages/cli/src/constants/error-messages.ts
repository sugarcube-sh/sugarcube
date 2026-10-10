import { plural } from "@sugarcube-sh/core";
import color from "picocolors";
import { COMMANDS } from "./commands.js";
import { LINKS } from "./links.js";

type Unread = { dir: string; count: number };

const unreadHeadline = (entries: Unread[]) => {
    const [first] = entries;
    if (entries.length === 1 && first) {
        return `Didn't read ${plural(first.count, "stylesheet")} in ${color.cyan(first.dir)}`;
    }

    const total = entries.reduce((sum, entry) => sum + entry.count, 0);
    const list = entries.map(({ dir, count }) => `  ${count} in ${color.cyan(dir)}`).join("\n");
    return `Didn't read ${plural(total, "stylesheet")}:\n\n${list}`;
};

const unreadFix = (entries: Unread[]) =>
    `Add the ${entries.length === 1 ? "folder" : "folders"} to ${color.cyan("content")}.`;

const noStylesheetsHelp = (cwd: string, also = "") =>
    `Looked below ${color.cyan(cwd)} and in your ${color.cyan("content")} globs.\nIf your CSS lives elsewhere, add it to ${color.cyan("content")}:\n\n  content: ["../css/**/*.css"]\n\n${also}See ${color.cyan(LINKS.CONFIGURATION)} for more information.`;

export const ERROR_MESSAGES = {
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

    VALIDATE_PATH_NOT_FOUND: (path: string) =>
        `Path not found: ${path}\n\nPlease check that the specified path exists`,

    VALIDATE_NO_TOKEN_FILES: () =>
        "No token files found.\n\nPlease ensure the path contains .json token files",

    COMPONENTS_FRAMEWORK_REQUIRED: () =>
        `Framework is required when specifying components. Use --framework to specify a framework (react, css-only) or run without arguments for interactive mode.\n\nSee ${color.cyan(
            LINKS.COMPONENTS_CLI,
        )} for more information.`,

    COMPONENTS_INVALID_FRAMEWORK: () => "Invalid framework. Must be one of: react, css-only.",

    FILENAME_CONTAINS_PATH: (flagName: string, value: string) =>
        `Invalid ${flagName} value: "${value}". Must be a filename, not a path.\n\nUse --variables-dir or --utilities-dir to specify the directory.`,

    LINT_NO_FILES_SCANNED: (cwd: string) =>
        `No stylesheets found, so nothing was linted.\n\n${noStylesheetsHelp(cwd, `Or name it for one run: ${color.cyan("sugarcube lint ../css")}\n\n`)}`,

    ANALYZE_UNUSED_NO_FILES_SCANNED: (cwd: string) =>
        `No stylesheets found. Tokens reached only through your CSS are listed as unused below.\n\n${noStylesheetsHelp(cwd)}`,

    ANALYZE_IMPACT_NO_FILES_SCANNED: (cwd: string) =>
        `No stylesheets found, so no CSS consumers of this token can be listed.\n\n${noStylesheetsHelp(cwd)}`,

    LINT_UNREAD_STYLESHEETS: (entries: Unread[]) =>
        `${unreadHeadline(entries)}\n\nThose files weren't checked. ${unreadFix(entries)}\n\n${color.cyan(LINKS.CONFIGURATION)}`,

    ANALYZE_UNREAD_STYLESHEETS: (entries: Unread[]) =>
        `${unreadHeadline(entries)}\n\nTokens used only there appear unused. ${unreadFix(entries)}\n\n${color.cyan(LINKS.CONFIGURATION)}`,

    NO_CSS_WRITTEN: () => "No CSS was written.",

    NOTHING_ANALYSED: () => "Nothing was analysed.",

    NOTHING_LINTED: () => "Nothing was linted.",

    ANALYZE_NO_TOKEN: (path: string) => `No token "${path}" in this system.`,

    ANALYZE_GROUP_NOT_TOKEN: (path: string) => `\`${path}\` is a group; impact takes one token.`,
} as const;
