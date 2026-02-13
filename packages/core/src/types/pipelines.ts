import type { InternalConfig } from "./config.js";
import type { FlattenError } from "./flatten.js";
import type { CSSFileOutput } from "./generate.js";
import type { LoadError, TokenMemoryData } from "./load.js";
import type { ResolutionError } from "./resolve.js";
import type { TokenTree } from "./tokens.js";
import type { ValidationError } from "./validate.js";

/**
 * Metadata about a modifier (e.g., theme, density) for CSS generation.
 * Used to build attribute selectors like [data-theme="dark"].
 */
export type ModifierMeta = {
    /** The modifier name (e.g., "theme", "density"). */
    name: string;
    /** The HTML attribute name (e.g., "data-theme", "data-density"). */
    attribute: string;
    /** The default context that uses :root selector. */
    defaultContext: string;
    /** Available non-default context names. */
    contexts: string[];
};

/**
 * Result of running the token processing pipeline.
 * Contains generated CSS output, processed tokens, and any errors encountered.
 */
export type PipelineResult = {
    /** The generated CSS files ready to be written to disk. */
    output: CSSFileOutput;
    /** The loaded and processed token trees. */
    trees: TokenTree[];
    /** Modifier metadata for CSS selector generation. */
    modifiers?: ModifierMeta[];
    /** Any errors that occurred during pipeline execution. */
    errors: PipelineErrors;
};

/**
 * Errors organized by the pipeline stage where they occurred.
 */
export type PipelineErrors = {
    /** Errors from loading token files. */
    load: LoadError[];
    /** Errors from flattening token trees. */
    flatten: FlattenError[];
    /** Errors from validating token values. */
    validation: ValidationError[];
    /** Errors from resolving token references. */
    resolution: ResolutionError[];
};

/**
 * Defines the source of tokens for the pipeline.
 *
 * @example
 * // Load from a DTCG resolver document
 * const source: TokenPipelineSource = {
 *   type: "resolver",
 *   resolverPath: "./tokens.resolver.json",
 *   config: internalConfig
 * };
 *
 * @example
 * // Load from in-memory data (for testing)
 * const source: TokenPipelineSource = {
 *   type: "memory",
 *   data: { "tokens.json": { content: '{"color": {...}}' } },
 *   config: internalConfig
 * };
 */
export type TokenPipelineSource =
    | {
          type: "resolver";
          /** Path to the DTCG resolver document (.resolver.json). */
          resolverPath: string;
          /** Pipeline configuration. */
          config: InternalConfig;
      }
    | {
          type: "memory";
          /** In-memory token data keyed by file path. */
          data: TokenMemoryData;
          /** Pipeline configuration. */
          config: InternalConfig;
      };
