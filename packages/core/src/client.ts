/**
 * The part of `@sugarcube-sh/core` that runs in a browser.
 *
 * It reads and writes no files. To read and write files in Node, use `@sugarcube-sh/core`.
 *
 * @example
 * import { generateCSS, createReadOptions } from "@sugarcube-sh/core/client";
 */

export { defineConfig, fillDefaultsWithDirs } from "./shared/config.js";
export { ConfigError, toConfigDiagnostics } from "./shared/config-error.js";

export { createReadOptions } from "./shared/read-options.js";
export { declare } from "./shared/css/declare.js";
export type { Declarations } from "./shared/css/declare.js";
export { getUtilityTokens } from "./shared/utilities/tokens.js";
export { generateCSS } from "./shared/css-from.js";
export { createCSSWriterOptions } from "./shared/css/writer-options.js";
export type { UtilityCSS } from "./shared/css-from.js";
export type { AnyDiagnostic } from "./types/diagnostics.js";

export { kebabCase } from "./shared/case.js";

export { SUGARCUBE_NAMESPACE } from "./shared/extensions.js";

export type {
    InternalConfig,
    SugarcubeConfig,
    ColorFallbackStrategy,
    UtilityClassesConfig,
    VariableNameFunction,
} from "./types/config.js";
export type { CSSFileOutput } from "./types/generate.js";

export { formatProblemBlocks, formatProblems } from "./shared/problems.js";
export type { ProblemContext } from "./shared/problems.js";
