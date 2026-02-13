import color from "picocolors";
import { COMMANDS } from "./commands.js";
import { LINKS } from "./links.js";

export const ERROR_MESSAGES = {
    PROJECT_REQUIRED:
        `No sugarcube project detected. Please run ${color.cyan(COMMANDS.INIT)} first.\n\n` +
        `For more information, visit: ${color.cyan(LINKS.INITIALIZATION)}`,

    CONFIG_EXISTS: () =>
        `A sugarcube config file already exists in this project.\n\nTo start over, remove it and run ${color.cyan(COMMANDS.INIT)} again.`,

    PLUGIN_INSTALL_FAILED: (ctx: { pluginToInstall: string; packageManager: string }) => {
        // npm uses 'install', others use 'add'
        const installCmd = ctx.packageManager === "npm" ? "install" : "add";
        return `Failed to install ${ctx.pluginToInstall} plugin.\n
This is usually a temporary issue. Try these steps:\n
1. Run the command again
2. Check your internet connection
3. Install manually: ${ctx.packageManager} ${installCmd} ${ctx.pluginToInstall}\n
If the problem continues, please open an issue at:\n${LINKS.ISSUES}`;
    },

    CLI_INSTALL_FAILED: (ctx: { packageManager: string }) => {
        const installCmd = ctx.packageManager === "npm" ? "install" : "add";
        return `Failed to install @sugarcube-sh/cli.\n
This is usually a temporary issue. Try these steps:\n
1. Run the command again
2. Check your internet connection
3. Install manually: ${ctx.packageManager} ${installCmd} -D @sugarcube-sh/cli\n
If the problem continues, please open an issue at:\n${LINKS.ISSUES}`;
    },

    INITIALIZATION_INCOMPLETE: () =>
        `The initialization process was not completed properly.\nThis is an internal error that should not occur.\nTry running the \`init\` command again.\n\nIf the problem persists, please report this issue at\n${LINKS.ISSUES}`,

    CONFIG_WRITE_FAILED: () =>
        "Failed to write configuration file. Check permissions and try again.",

    DIRECTORY_PATH_EMPTY: (optionName: string) =>
        `${optionName} cannot be empty. Please provide a valid directory path.`,

    DIRECTORY_PATH_RESERVED: (optionName: string, dirPath: string) =>
        `Option: ${optionName}\nValue: "${dirPath}"\n\n${optionName} cannot be in a reserved directory`,

    KIT_INCOMPLETE: () =>
        "The starter kit appears to be incomplete or corrupted.\n\nThis is likely a temporary issue. Please try running the command again or choose a different starter kit.",

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

    RESOLVER_NOT_CONFIGURED: () =>
        `No resolver path configured.\n\nAdd a resolver path to your sugarcube config:\n\n${color.cyan(
            `export default {\n  resolver: "./tokens.resolver.json",\n  // ...\n}`
        )}\n\nSee ${color.cyan(LINKS.RESOLVER)} for more information.`,

    RESOLVER_NOT_FOUND: (tokensDir: string) =>
        `No resolver document found in ${color.cyan(
            tokensDir
        )}.\n\nA resolver document (*.resolver.json) is required to define how your tokens are loaded.\n\nSee ${color.cyan(
            LINKS.RESOLVER
        )} to learn how to create one.`,

    RESOLVER_MULTIPLE_FOUND: (paths: string[]) =>
        `Multiple resolver documents found:\n${paths.map((p) => `  - ${color.cyan(p)}`).join("\n")}\n\nA project should have only one resolver document. Please remove the extras or consolidate them.`,

    TOKEN_LOAD_FAILED: (errorMessages: string[]) =>
        `Failed to load token files:\n\n${errorMessages.join("\n")}\n\nPlease check your token files and try again.`,

    TOKEN_VALIDATION_FAILED: (errorsByFile: Map<string, string[]>) => {
        let errorMessage = "Token validation failed:\n\n";

        for (const [sourcePath, messages] of errorsByFile) {
            errorMessage += `Error(s) in ${color.cyan(sourcePath)}:\n`;
            for (const message of messages) {
                errorMessage += `  - ${message}\n`;
            }
            errorMessage += "\n";
        }

        errorMessage += `See ${color.cyan(LINKS.DESIGN_TOKENS)} for valid token formats`;

        return errorMessage;
    },

    TOKEN_FILE_INVALID_JSON: (fileName: string) => `File ${fileName}: Invalid JSON syntax`,

    TOKEN_FILE_INCOMPLETE_JSON: (fileName: string) => `File ${fileName}: Incomplete JSON file`,

    TOKEN_FILE_GENERIC_ERROR: (fileName: string, message: string) => `File ${fileName}: ${message}`,

    DEPENDENCY_INSTALL_FAILED: (packageManager: string) =>
        `Failed to install dependencies using ${packageManager}.\nPlease check your package manager configuration and try again.`,

    VALIDATE_NO_PATH_SPECIFIED: () =>
        `No path specified.\n\nRun ${color.cyan("sugarcube validate --help")} for more information.`,

    VALIDATE_PATH_NOT_FOUND: (path: string) =>
        `Path not found: ${path}\n\nPlease check that the specified path exists`,

    VALIDATE_NO_TOKEN_FILES: () =>
        "No token files found.\n\nPlease ensure the path contains .json token files",

    COMPONENTS_FRAMEWORK_REQUIRED: () =>
        `Framework is required when specifying components. Use --framework to specify a framework (react, css-only) or run without arguments for interactive mode.\n\nSee ${color.cyan(
            LINKS.COMPONENTS_CLI
        )} for more information.`,

    COMPONENTS_INVALID_FRAMEWORK: () => "Invalid framework. Must be one of: react, css-only.",

    COMPONENTS_DIRECTORY_NOT_CONFIGURED: () =>
        "Components directory must be configured in non-interactive mode. Please run the 'components' command without arguments first.",

    PLUGIN_DETECTED: (pluginName: string) =>
        `Plugin detected: ${pluginName}\n\nThe 'generate' command is for manual generation without plugins. Since you have a plugin installed, use your development server instead:\n\nnpm run dev  # or your framework's dev command\n\nThe plugin will automatically generate CSS with hot module replacement.`,

    GENERATE_NO_CONFIG_OR_RESOLVER: () =>
        `No design tokens found.\n\nRun ${color.cyan(COMMANDS.INIT)} to set up your design tokens.\n\nStuck? ${color.cyan(
            LINKS.HOMEPAGE
        )}`,

    GENERATE_MULTIPLE_RESOLVERS_NO_CONFIG: (paths: string[]) =>
        `No config file found, but multiple resolver files detected:\n${paths.map((p) => `  - ${p}`).join("\n")}\n\nPlease either:\n  - Create a config file with ${color.cyan(COMMANDS.INIT)}\n  - Use --resolver flag to specify which resolver to use`,
} as const;
