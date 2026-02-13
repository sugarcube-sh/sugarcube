import { ERROR_MESSAGES } from "../constants/index.js";
import {
    CLIError,
    type Framework,
    type RegistryItemType,
    fileContentResponseSchema,
    registryIndexSchema,
} from "../types/index.js";

const REGISTRY_URL = process.env.REGISTRY_URL ?? "https://sugarcube.sh/r";

async function fetchRegistry(url: string) {
    try {
        const response = await fetch(url);

        if (!response.ok) {
            if (response.status === 401) {
                throw new CLIError(ERROR_MESSAGES.REGISTRY_AUTH_REQUIRED(url));
            }

            if (response.status === 403) {
                throw new CLIError(ERROR_MESSAGES.REGISTRY_AUTH_INVALID(url));
            }

            if (response.status === 404) {
                throw new CLIError(ERROR_MESSAGES.REGISTRY_NOT_FOUND(url));
            }

            const result = await response.json().catch(() => null);
            const message =
                result && typeof result === "object" && "error" in result
                    ? String(result.error)
                    : response.statusText;

            throw new CLIError(ERROR_MESSAGES.REGISTRY_REQUEST_FAILED(message, url));
        }

        return response.json();
    } catch (error) {
        if (error instanceof CLIError) throw error;

        throw new CLIError(ERROR_MESSAGES.REGISTRY_NETWORK_ERROR(url));
    }
}

export async function getRegistryIndex() {
    const url = `${REGISTRY_URL}/index.json`;
    const result = await fetchRegistry(url);
    try {
        return registryIndexSchema.parse(result);
    } catch (error) {
        throw new CLIError(ERROR_MESSAGES.REGISTRY_INVALID_DATA(url));
    }
}

export async function getRegistryFiles({
    type,
    name,
    framework,
}: {
    type: RegistryItemType;
    name: string;
    framework?: Framework;
}) {
    const registry = await getRegistryIndex();
    const item = registry.find((i) => i.type === type && i.name === name);

    if (!item) {
        const availableItems = registry.filter((i) => i.type === type).map((i) => i.name);
        throw new CLIError(ERROR_MESSAGES.REGISTRY_ITEM_NOT_FOUND(type, name, availableItems));
    }

    let selectedFiles = item.files;
    if (type === "component" && framework) {
        selectedFiles = item.files.filter(
            (file): file is typeof file & { framework: Framework } =>
                "framework" in file && file.framework === framework
        );
    }

    const files = await Promise.all(
        selectedFiles.map(async (file) => {
            const url = `${REGISTRY_URL}/${file.path}.json`;
            const result = await fetchRegistry(url);
            try {
                const parsed = fileContentResponseSchema.parse(result);
                return {
                    path: file.path,
                    type: file.type,
                    framework: "framework" in file ? file.framework : undefined,
                    content: parsed.content,
                };
            } catch (error) {
                throw new CLIError(ERROR_MESSAGES.REGISTRY_FILE_INVALID(file.path));
            }
        })
    );

    return {
        item,
        files,
    };
}

export async function fetchStarterKit(kitChoice: string) {
    const result = await getRegistryFiles({
        type: "tokens",
        name: kitChoice,
    });

    if (!result.files[0]) {
        throw new CLIError(ERROR_MESSAGES.STARTER_KIT_UNAVAILABLE(kitChoice));
    }

    return result;
}
