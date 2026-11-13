import { validateSugarcubeConfig } from "../src/shared/config.js";
import { ConfigError } from "../src/shared/config-error.js";
import { formatConfigIssue } from "../src/shared/constants/error-messages.js";
import type { ConfigIssue } from "../src/types/diagnostics.js";

export function issuesIn(config: unknown): ConfigIssue[] {
    try {
        validateSugarcubeConfig(config);
        return [];
    } catch (error) {
        if (!(error instanceof ConfigError)) throw error;
        return error.issues;
    }
}

export function mistakesIn(config: unknown): string[] {
    return issuesIn(config).map(formatConfigIssue);
}
