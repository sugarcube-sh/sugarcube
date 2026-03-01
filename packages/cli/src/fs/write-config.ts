import { writeFile } from "node:fs/promises";
import type { userConfigSchema } from "@sugarcube-sh/core";
import type { z } from "zod";
import { LINKS } from "../constants/links.js";
import { CLIError } from "../types/index.js";
import { getConfigFileName } from "../utils/config-filename.js";

function isValidIdentifier(key: string): boolean {
    return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key);
}

function formatValue(value: unknown, indent = 0): string {
    const spaces = "  ".repeat(indent);

    if (value === null) {
        return "null";
    }

    if (value === undefined) {
        return "undefined";
    }

    if (typeof value === "string") {
        return JSON.stringify(value);
    }

    if (typeof value === "number" || typeof value === "boolean") {
        return String(value);
    }

    if (Array.isArray(value)) {
        if (value.length === 0) {
            return "[]";
        }
        const items = value
            .map((item) => `${spaces}  ${formatValue(item, indent + 1)}`)
            .join(",\n");
        return `[\n${items}\n${spaces}]`;
    }

    if (typeof value === "object") {
        const entries = Object.entries(value);
        if (entries.length === 0) {
            return "{}";
        }
        const props = entries
            .map(([key, val]) => {
                const formattedKey = isValidIdentifier(key) ? key : JSON.stringify(key);
                return `${spaces}  ${formattedKey}: ${formatValue(val, indent + 1)}`;
            })
            .join(",\n");
        return `{\n${props}\n${spaces}}`;
    }

    return JSON.stringify(value);
}

function formatConfigAsCode(config: Record<string, unknown>): string {
    const formattedConfig = formatValue(config, 0);
    return `// Configuration reference: ${LINKS.CONFIGURATION}\nexport default ${formattedConfig};\n`;
}

export async function writeSugarcubeConfig(validatedConfig: z.infer<typeof userConfigSchema>) {
    try {
        const configFileName = await getConfigFileName();
        const content = formatConfigAsCode(validatedConfig);
        await writeFile(configFileName, content, "utf-8");
    } catch (error) {
        const errorMessage = error instanceof Error ? `: ${error.message}` : "";
        throw new CLIError(`Failed to write config file${errorMessage}`);
    }
}
