import type { ExpandError } from "../shared/pipeline/expand.js";
import type { InternalConfig } from "./config.js";
import type { FlattenError } from "./flatten.js";
import type { CSSFileOutput } from "./generate.js";
import type { LoadError, TokenMemoryData } from "./load.js";
import type { ResolutionError } from "./resolve.js";
import type { TokenTree } from "./tokens.js";
import type { ValidationError } from "./validate.js";

/** A non-blocking warning from the pipeline. */
export type PipelineWarning = {
    /** Location of the warning (file path or JSON path) */
    path: string;
    /** Human-readable warning message */
    message: string;
};

/**
 * An event emitted by the pipeline during execution.
 *
 * In the future, this could be extended to support real-time streaming of pipeline
 * progress to consumers like Studio
 */
export type PipelineEvent =
    | { type: "warning"; warning: PipelineWarning }
    | { type: "stage:start"; stage: string }
    | { type: "stage:end"; stage: string; durationMs: number }
    | { type: "info"; message: string };

/**
 * Shared context threaded through pipeline stages.
 *
 * Provides a unified way for any stage to emit warnings and events without
 * changing return types. Consumers (CLI, Vite plugin, Studio) create the
 * context and decide how to handle events.
 */
export type PipelineContext = {
    /** Accumulated warnings from all pipeline stages. */
    warnings: PipelineWarning[];
    /** Push a warning and emit a warning event in one call. */
    warn: (warning: PipelineWarning) => void;
    /** Emit a pipeline event. No-op by default; consumers can provide a handler. */
    emit: (event: PipelineEvent) => void;
};

/**
 * Create a PipelineContext with sensible defaults.
 * Pass an `emit` handler to subscribe to real-time pipeline events.
 */
export function createPipelineContext(
    options: { emit?: (event: PipelineEvent) => void } = {}
): PipelineContext {
    const warnings: PipelineWarning[] = [];
    const seen = new Set<string>();
    const emit = options.emit ?? (() => {});

    return {
        warnings,
        emit,
        warn(warning: PipelineWarning) {
            const key = `${warning.path}::${warning.message}`;
            if (seen.has(key)) return;
            seen.add(key);
            warnings.push(warning);
            emit({ type: "warning", warning });
        },
    };
}

/**
 * Result of running the token processing pipeline.
 * Contains generated CSS output, processed tokens, and any errors encountered.
 */
export type PipelineResult = {
    /** The generated CSS files ready to be written to disk. */
    output: CSSFileOutput;
    /** The loaded and processed token trees. */
    trees: TokenTree[];
    /** Any errors that occurred during pipeline execution. */
    errors: PipelineErrors;
    /** Non-blocking warnings that don't prevent generation. */
    warnings: PipelineWarning[];
};

/**
 * Errors organized by the pipeline stage where they occurred.
 */
export type PipelineErrors = {
    /** Errors from loading token files. */
    load: LoadError[];
    /** Errors from expanding $ref and $extends in token trees. */
    expandTree: ExpandError[];
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
