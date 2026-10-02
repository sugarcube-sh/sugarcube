import { type Document, byToken } from "@sugarcube-sh/dtcg";
import type { InternalConfig } from "../../types/config.js";
import { createVariableNameResolver } from "../resolve-variable-name.js";

/**
 * The CSS custom property name of every token, without the leading `--`, worked out once from the
 * config's `prefix` or `variableName`. Declarations, references and utility classes all read it,
 * so they cannot disagree.
 *
 * @example
 * cssNames(doc, config).get("color.brand") // "ds-color-brand", with prefix "ds"
 */
export function cssNames(doc: Document, config: InternalConfig): Map<string, string> {
    const nameOf = createVariableNameResolver(config.variables);
    return new Map(byToken(doc).map(({ path }) => [path, nameOf(path)]));
}
