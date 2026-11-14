import { Command } from "commander";
import color from "picocolors";
import { CLIError } from "../cli-error.js";
import { ErrorMessages } from "../constants/error-messages.js";
import { handleError } from "../handle-error.js";
import { writeComponentFiles } from "../installation/components.js";
import { installDependencies } from "../installation/dependencies.js";
import {
    confirmOverwriting,
    findComponentFilesToOverwrite,
} from "../overwrite-warnings/collect-overwrite-warnings.js";
import { getComponentsDir } from "../project/output-dirs.js";
import { promptComponentFramework, promptComponentSelectionFiltered } from "../prompts/prompts.js";
import { getRegistryIndex } from "../registry/client.js";
import { resolveTree } from "../registry/dependency-tree.js";
import type { RegistryItem } from "../types/registry.js";

import { isPackageInstalled } from "../project/is-package-installed.js";
import { getPackageManager } from "../project/package-manager.js";
import { intro, label } from "../prompts/common.js";
import { log, rawLog } from "../prompts/log.js";

const SUPPORTED_FRAMEWORKS = ["react", "css-only"] as const;

type SupportedFramework = (typeof SUPPORTED_FRAMEWORKS)[number];

export interface RunComponentsOptions {
    framework?: string;
    output?: string;
    silent?: boolean;
    force?: boolean;
    skipIntro?: boolean;
    skipOutro?: boolean;
    continueOnDecline?: boolean;
}

export async function runComponents(
    componentArgs: string[] = [],
    options: RunComponentsOptions = {},
): Promise<void> {
    if (!options.silent && !options.skipIntro) {
        intro(label(color.bgGreen(color.black("Components"))));
    }

    const { directory: componentsOutputDirectory } = await getComponentsDir(options.output);
    const { framework, selectedComponents, registryIndex } = await chooseComponents(
        componentArgs,
        options.framework,
    );
    const packageManager = await getPackageManager(process.cwd(), { withFallback: true });
    const componentsToInstall = await resolveTree(registryIndex, selectedComponents, framework);

    const filesToOverwrite = findComponentFilesToOverwrite({
        components: componentsToInstall,
        framework,
        componentsOutputDirectory,
    });
    if (!(await confirmOverwriting("component", filesToOverwrite, options))) return;

    const tasks = [];
    const depsToInstall = getMissingDependencies(componentsToInstall, framework);
    if (depsToInstall.length > 0) {
        tasks.push({
            pending: `Install ${depsToInstall.length} dependencies`,
            start: `Installing ${depsToInstall.join(", ")}...`,
            end: `Installed ${depsToInstall.join(", ")}`,
            while: () => installDependencies(depsToInstall, process.cwd(), packageManager),
        });
    }
    for (const component of componentsToInstall) {
        tasks.push({
            pending: `Write component files for ${component.name}`,
            start: `Writing component files for ${component.name}...`,
            end: `Wrote component files for ${component.name}`,
            while: () => writeComponentFiles(component, framework, componentsOutputDirectory),
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

async function chooseComponents(
    componentArgs: string[],
    frameworkFlag: string | undefined,
): Promise<{
    framework: SupportedFramework;
    selectedComponents: string[];
    registryIndex: RegistryItem[];
}> {
    if (componentArgs.length === 0 && !frameworkFlag) {
        const framework = (await promptComponentFramework(false)) as SupportedFramework;
        const registryIndex = await getRegistryIndex();
        const selectedComponents = await promptComponentSelectionFiltered(registryIndex, framework);
        return { framework, selectedComponents, registryIndex };
    }

    if (!frameworkFlag) {
        throw new CLIError(ErrorMessages.COMPONENTS_FRAMEWORK_REQUIRED(SUPPORTED_FRAMEWORKS));
    }
    if (!isSupportedFramework(frameworkFlag)) {
        throw new CLIError(ErrorMessages.COMPONENTS_INVALID_FRAMEWORK(SUPPORTED_FRAMEWORKS));
    }
    return {
        framework: frameworkFlag,
        selectedComponents: componentArgs,
        registryIndex: await getRegistryIndex(),
    };
}

function isSupportedFramework(framework: string): framework is SupportedFramework {
    return (SUPPORTED_FRAMEWORKS as readonly string[]).includes(framework);
}

function getMissingDependencies(
    components: RegistryItem[],
    framework: SupportedFramework,
): string[] {
    const dependencies = new Set(
        components.flatMap((component) => component.dependencies?.[framework] ?? []),
    );
    return [...dependencies].filter((name) => !isPackageInstalled(name, process.cwd()));
}

export const components = new Command()
    .name("components")
    .description("Add components to your project")
    .argument("[components...]", "Components to add (e.g., button card)")
    .option("-f, --framework <type>", `Framework to use (${SUPPORTED_FRAMEWORKS.join(", ")})`)
    .option("-o, --output <dir>", "Components output directory (e.g., 'src/components')")
    .option("-s, --silent", "Suppress logs and prompts")
    .option("--force", "Skip overwrite confirmation")
    .action(async (componentNames, options) => {
        try {
            await runComponents(componentNames, options);
        } catch (error) {
            handleError(error);
        }
    });
