import { CLIError, type Framework, type RegistryItem } from "../types/index.js";

export async function resolveTree(index: RegistryItem[], names: string[], framework: Framework) {
    const tree: RegistryItem[] = [];
    const seen = new Set<string>();

    async function resolveComponent(name: string) {
        if (seen.has(name)) return;
        seen.add(name);

        const entry = index.find((entry) => entry.name === name);
        if (!entry) {
            const available = index
                .filter((item) => item.type === "component")
                .map((item) => item.name)
                .join(", ");
            throw new CLIError(
                `Component '${name}' not found in registry\nAvailable components: ${available}`
            );
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
