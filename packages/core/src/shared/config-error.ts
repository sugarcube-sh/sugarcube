import type { ConfigIssue, Reported } from "../types/diagnostics.js";
import { configIssueText } from "./constants/error-messages.js";
import { diagnostic } from "./diagnostics.js";

/**
 * A problem in the config a person wrote, or in finding their tokens, so a host can show it as
 * their mistake rather than a crash. It carries each issue as facts, worded by
 * {@link configProblems} for a host that places them at the config file.
 */
export class ConfigError extends Error {
    override name = "ConfigError";
    readonly issues: ConfigIssue[];

    constructor(issues: ConfigIssue[], options?: ErrorOptions) {
        super(issues.map(standalone).join("\n"), options);
        this.issues = issues;
    }
}

export function configProblems(error: ConfigError): Reported[] {
    return error.issues.map((issue) => diagnostic("invalid-config", issue));
}

function standalone(issue: ConfigIssue): string {
    const text = configIssueText(issue);
    const fileGoesFirst = issue.reason === "not-loaded" || issue.reason === "deleted";
    return fileGoesFirst ? `${issue.file} ${text}` : text;
}
