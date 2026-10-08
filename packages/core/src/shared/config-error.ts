import type { Reported } from "../types/diagnostics.js";
import { diagnostic } from "./diagnostics.js";

/**
 * A problem in the config a person wrote, or in finding their tokens, so a host can show it as
 * their mistake rather than a crash.
 */
export class ConfigError extends Error {
    override name = "ConfigError";
}

/** A config error as a problem, for a host that shows it beside the tokens' problems. */
export function configProblem(error: ConfigError): Reported {
    return diagnostic("invalid-config", { problem: error.message });
}
