import { log, multiselect, select } from "@clack/prompts";
import { cancel, confirm, isCancel } from "@clack/prompts";
import color from "picocolors";
import type { ComponentChoice, RegistryItem } from "../types/index.js";

export async function promptComponentFramework(includeSkip = true): Promise<ComponentChoice> {
    const options = [
        { label: "React", value: "react", hint: ".tsx" },
        { label: "CSS Only", value: "css-only", hint: ".css" },
        {
            label: color.dim("Web components"),
            value: "web-components",
            hint: "Coming soon!",
        },
    ];

    if (includeSkip) {
        options.push({
            label: "Skip",
            value: "skip",
            hint: "continue without components",
        });
    }

    const componentType = await select({
        message: "Build with",
        options,
    });

    if (isCancel(componentType)) {
        process.exit(0);
    }

    if (componentType === "web-components") {
        log.info(
            color.blue("Web components are coming soon! Please choose React or CSS Only for now.")
        );
        return promptComponentFramework(includeSkip);
    }

    return componentType as ComponentChoice;
}

export async function promptComponentSelectionFiltered(
    registryIndex: RegistryItem[],
    componentType: string
) {
    const filtered = registryIndex.filter((entry) => {
        return entry.type === "component" && entry.frameworks?.includes(componentType);
    });

    const selected = await multiselect({
        message: "Select components to add",
        options: filtered.map((entry) => ({
            label: entry.name,
            value: entry.name,
            hint: entry.description,
        })),
        required: true,
    });

    if (isCancel(selected)) {
        process.exit(0);
    }

    return selected as string[];
}

export async function confirmOverwrite(message: string, initialValue = false): Promise<boolean> {
    const proceed = await confirm({
        message,
        initialValue,
    });

    if (!proceed || isCancel(proceed)) {
        cancel();
        process.exit(0);
    }

    return true;
}
