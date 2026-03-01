import { Command } from "commander";
import color from "picocolors";
import { ERROR_MESSAGES } from "../constants/index.js";
import { collectComponentOverwriteWarnings } from "../fs/collect-overwrite-warnings.js";
import { formatOverwriteWarnings } from "../fs/format-overwrite-warnings.js";
import { installComponents, installDependencies } from "../installation/index.js";
import {
    confirmOverwrite,
    promptComponentFramework,
    promptComponentSelectionFiltered,
} from "../prompts/prompts.js";
import { getRegistryIndex } from "../registry/client.js";
import { CLIError } from "../types/index.js";
import { getComponentsDir } from "../utils/config-helpers.js";
import { handleError } from "../utils/handle-error.js";
import { resolveTree } from "../utils/resolve-dependencies.js";

import { cancel } from "@clack/prompts";
import { isPackageInstalled } from "../detection/is-package-installed.js";
import { getPackageManager } from "../detection/package-manager.js";
import { warningBoxWithBadge } from "../prompts/box-with-badge.js";
import { intro, label } from "../prompts/common.js";
import { log, rawLog } from "../prompts/log.js";

type SupportedFramework = "react" | "css-only";

export interface RunComponentsOptions {
    framework?: string;
    componentsDir?: string;
    silent?: boolean;
    overwrite?: boolean;
    skipIntro?: boolean;
    skipOutro?: boolean;
    continueOnDecline?: boolean;
}

export async function runComponents(
    componentArgs: string[] = [],
    options: RunComponentsOptions = {}
): Promise<void> {
    if (!options.silent && !options.skipIntro) {
        intro(label(color.bgGreen(color.black("Components"))));
    }

    const { directory: componentsOutputDirectory } = await getComponentsDir(options.componentsDir);

    let selectedComponents: string[] = [];
    let componentType: SupportedFramework;

    if (componentArgs.length > 0 || options.framework) {
        if (!options.framework) {
            throw new CLIError(ERROR_MESSAGES.COMPONENTS_FRAMEWORK_REQUIRED());
        }

        const validFrameworks = ["react", "css-only"] as const;
        if (!validFrameworks.includes(options.framework as SupportedFramework)) {
            throw new CLIError(ERROR_MESSAGES.COMPONENTS_INVALID_FRAMEWORK());
        }

        componentType = options.framework as SupportedFramework;
        selectedComponents = componentArgs;
    } else {
        componentType = (await promptComponentFramework(false)) as SupportedFramework;

        const registryIndex = await getRegistryIndex();
        if (!registryIndex) {
            cancel("Failed to fetch component list");
            process.exit(1);
        }

        selectedComponents = await promptComponentSelectionFiltered(registryIndex, componentType);
    }

    const packageManager = await getPackageManager(process.cwd(), {
        withFallback: true,
    });

    const registryIndex = await getRegistryIndex();
    const tree = await resolveTree(registryIndex, selectedComponents, componentType);

    const warnings = await collectComponentOverwriteWarnings({
        selectedComponents,
        componentType,
        componentsOutputDirectory,
    });

    const warningMessage = formatOverwriteWarnings(warnings);
    if (warningMessage && !options.overwrite && !options.silent) {
        const warningBox = warningBoxWithBadge(warningMessage, {});
        log.space(1);
        warningBox;
        const confirmed = await confirmOverwrite("Continue?", false, {
            exitOnDecline: !options.continueOnDecline,
        });
        if (!confirmed) return;
    }

    const tasks = [];
    const allCreatedFiles: string[] = [];

    const npmDeps = new Set<string>();
    for (const component of tree) {
        const frameworkDeps = component.dependencies?.[componentType] || [];
        for (const dep of frameworkDeps) {
            npmDeps.add(dep);
        }
    }

    const depsToInstall = Array.from(npmDeps).filter(
        (dep) => !isPackageInstalled(dep, process.cwd())
    );

    if (depsToInstall.length > 0) {
        tasks.push({
            pending: `Install ${depsToInstall.length} dependencies`,
            start: `Installing ${depsToInstall.join(", ")}...`,
            end: `Installed ${depsToInstall.join(", ")}`,
            while: async () => {
                await installDependencies(depsToInstall, process.cwd(), packageManager);
            },
        });
    }

    for (const component of tree) {
        tasks.push({
            pending: `Write component files for ${component.name}`,
            start: `Writing component files for ${component.name}...`,
            end: `Wrote component files for ${component.name}`,
            while: async () => {
                const result = await installComponents({
                    registryIndex,
                    selectedComponents: [component.name],
                    componentType,
                    componentsOutputDirectory,
                    overwrite: options.overwrite || false,
                    packageManager,
                });
                allCreatedFiles.push(...result.createdFiles);
            },
        });
    }

    await log.tasks(tasks, {
        minDurationMs: 0,
        ...(options.skipOutro
            ? {}
            : { successMessage: "Components added successfully! 🎉 ", successAsOutro: true }),
    });
    if (!options.skipOutro) {
        rawLog("");
    }
}

export const components = new Command()
    .name("components")
    .description("Add components to your project")
    .argument("[components...]", "Components to add (e.g., button card)")
    .option("-f, --framework <type>", "Framework to use (react, css-only)")
    .option("--components-dir <dir>", "Components output directory (e.g., 'src/components')")
    .option("-s, --silent", "Suppress logs and prompts")
    .option("-o, --overwrite", "Overwrite existing files")
    .action(async (components, options) => {
        try {
            await runComponents(components, options);
        } catch (error) {
            handleError(error);
        }
    });
