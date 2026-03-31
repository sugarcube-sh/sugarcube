import { parseResolverDocument } from "../resolver/parse-resolver.js";
import type { LoadError } from "../types/load.js";
import type { PipelineContext } from "../types/pipelines.js";
import type { ResolverDocument } from "../types/resolver.js";

export type ParseResolverResult =
    | { document: ResolverDocument; errors: null }
    | { document: null; errors: LoadError[] };

/**
 * Pipeline stage: parse a resolver document and feed warnings into the context.
 */
export async function parseResolver(
    resolverPath: string,
    context: PipelineContext
): Promise<ParseResolverResult> {
    const parseResult = await parseResolverDocument(resolverPath);

    if (parseResult.errors.length > 0) {
        return {
            document: null,
            errors: parseResult.errors.map((e) => ({ file: e.path, message: e.message })),
        };
    }

    for (const warning of parseResult.warnings) {
        context.warn(warning);
    }

    return { document: parseResult.document, errors: null };
}
