/**
 * A problem in the config a person wrote, or in finding their tokens, so a host can show it as
 * their mistake rather than a crash.
 */
export class ConfigError extends Error {
    override name = "ConfigError";
}
