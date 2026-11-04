/**
 * Browser-safe entry point for @sugarcube-sh/core.
 *
 * Use this in any non-Node context — browsers, web workers, edge functions:
 *
 *     import { cssFrom, readOptions } from "@sugarcube-sh/core/client";
 *
 * For Node contexts use the main `@sugarcube-sh/core` entry, which adds
 * file loaders, writers, and the Node-side `fillDefaults`.
 */

export { defineConfig, fillDefaultsCore } from "./shared/config.js";
export { ConfigError, configProblems } from "./shared/config-error.js";

export { readOptions } from "./shared/read-options.js";
export { declare } from "./shared/css/declare.js";
export type { Declarations } from "./shared/css/declare.js";
export { utilityTokens } from "./shared/utilities/tokens.js";
export { cssFrom } from "./shared/css-from.js";
export { cssWriterOptions } from "./shared/css/writer-options.js";
export type { UtilityCSS } from "./shared/css-from.js";
export type { Reported } from "./types/diagnostics.js";

export { kebabCase } from "./shared/case.js";

export { SUGARCUBE_NAMESPACE } from "./shared/extensions.js";

export type {
    InternalConfig,
    SugarcubeConfig,
    ColorFallbackStrategy,
    UtilityClassesConfig,
    VariableNameFn,
} from "./types/config.js";
export type { CSSFileOutput } from "./types/generate.js";

export { problemCount, problemLines, problemsText } from "./shared/problems.js";
export type { Where } from "./shared/problems.js";
