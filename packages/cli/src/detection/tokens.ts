import fs from "node:fs/promises";
import { glob } from "tinyglobby";
import { JSON_GLOB_PATTERN, MAX_TOKEN_DETECTION_DEPTH } from "../constants/index.js";

function hasAnyToken(obj: Record<string, any>, depth = 0): boolean {
    if (typeof obj !== "object" || obj === null || depth > MAX_TOKEN_DETECTION_DEPTH) {
        return false;
    }

    for (const [key, value] of Object.entries(obj)) {
        if (key.startsWith("$")) continue;

        if (typeof value === "object" && value !== null) {
            if ("$value" in value) {
                return true;
            }
            if (hasAnyToken(value, depth + 1)) {
                return true;
            }
        }
    }
    return false;
}

export async function detectExistingTokens(tokensDir: string): Promise<boolean> {
    try {
        const files = await glob([JSON_GLOB_PATTERN], {
            cwd: tokensDir,
            absolute: true,
        });

        for (const file of files) {
            try {
                const content = await fs.readFile(file, "utf-8");
                const parsed = JSON.parse(content);
                if (hasAnyToken(parsed)) {
                    return true;
                }
            } catch {
                // Must be a non-JSON file, so just skip it!
            }
        }
        return false;
    } catch {
        // If we get here, we'll assume the directory doesn't exist or permission was denied, etc.
        return false;
    }
}
