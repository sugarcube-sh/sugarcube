import { CLIError } from "../cli-error.js";
import { ErrorMessages } from "../constants/error-messages.js";
import type { Framework, RegistryItem } from "../types/registry.js";

export async function resolveTree(index: RegistryItem[], names: string[], framework: Framework) {
    const tree: RegistryItem[] = [];
    const seen = new Set<string>();

    async function resolveComponent(name: string) {
        if (seen.has(name)) return;
        seen.add(name);

        const entry = index.find((item) => item.name === name);
        if (!entry) {
            const available = index
                .filter((item) => item.type === "component")
                .map((item) => item.name);
            throw new CLIError(ErrorMessages.COMPONENT_NOT_FOUND(name, available));
        }

        const registryDeps = entry.registryDependencies?.[framework] || [];

        for (const dep of registryDeps) {
            await resolveComponent(dep);
        }

        tree.push(entry);
    }

    for (const name of names) {
        await resolveComponent(name);
    }

    return tree;
}
