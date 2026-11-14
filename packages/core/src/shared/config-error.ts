import type { ConfigIssue, AnyDiagnostic } from "../types/diagnostics.js";
import { formatConfigIssue } from "./constants/error-messages.js";
import { createDiagnostic } from "./diagnostics.js";

/**
 * Thrown for mistakes in the config, or in finding the tokens.
 *
 * Each issue is in `issues`. {@link toConfigDiagnostics} turns them into diagnostics.
 */
export class ConfigError extends Error {
    override name = "ConfigError";
    readonly issues: ConfigIssue[];

    constructor(issues: ConfigIssue[], options?: ErrorOptions) {
        super(issues.map(formatIssue).join("\n"), options);
        this.issues = issues;
    }
}

export function toConfigDiagnostics(error: ConfigError): AnyDiagnostic[] {
    return error.issues.map((issue) => createDiagnostic("invalid-config", issue));
}

function formatIssue(issue: ConfigIssue): string {
    const text = formatConfigIssue(issue);
    const fileGoesFirst = issue.reason === "not-loaded" || issue.reason === "deleted";
    return fileGoesFirst ? `${issue.file} ${text}` : text;
}
