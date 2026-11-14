import type { DesignTokens, Source, Token } from "@sugarcube-sh/dtcg";
import type { CSSWriterOptions } from "@sugarcube-sh/dtcg/css";
import type { FluidViewport, InternalConfig } from "../../types/config.js";
import { SUGARCUBE_NAMESPACE } from "../extensions.js";
import { type FluidRange, toPixels, readFluid } from "../fluid.js";
import { findFallbacks, toSupportsCondition } from "./polyfill.js";
import { calculateClamp, roundValue } from "./utopia.js";

type SugarcubeWriterOptions = CSSWriterOptions & { skip: (token: Token) => boolean };

/**
 * Builds the options for `dtcg`'s CSS writer from the config.
 *
 * They name variables from the config and skip private tokens.
 * A fluid dimension is written as `clamp()`, and a gradient as `linear-gradient()`.
 *
 * @param tokens - The design tokens read with `createReadOptions`.
 * @param config - The config with its defaults.
 *
 * @example
 * const writer = createCSSWriter(createCSSWriterOptions(tokens, config));
 * writer.getDeclarations(tokens.getPermutation({ mode: "dark" })).declarations[0]?.name
 * // => "--color-blue-500"
 */
export function createCSSWriterOptions(
    tokens: DesignTokens,
    config: InternalConfig,
): SugarcubeWriterOptions {
    const { prefix, case: casing, delimiter, variableName, transforms } = config.variables;
    const skip = createIsPrivate();
    return {
        naming: { prefix, case: casing, delimiter, getName: variableName },
        skip,
        writeValue: (token, { value, write }) => {
            if (token.type === "dimension") {
                const fluid = readFluid(
                    token.extensions?.[SUGARCUBE_NAMESPACE],
                    tokens.parseOptions,
                );
                if (!fluid.ok) return undefined;
                if (fluid.value) return toClamp(fluid.value, transforms.fluid);
            }
            return token.type === "gradient" && !token.getReferenceAt()
                ? write`linear-gradient(${value})`
                : value;
        },
        ...(transforms.colorFallbackStrategy === "polyfill" && {
            writeFallback: (token, { rewrite }) => {
                const { spaces } = findFallbacks(token, skip);
                const hex = spaces.length > 0 ? rewrite({ colors: "hex" }) : undefined;
                return hex && { value: hex, condition: toSupportsCondition(spaces) };
            },
        }),
    };
}

function createIsPrivate(): (token: Token) => boolean {
    const privateBySource = new Map<Source, boolean>();
    return ({ winningDefinition: { source } }) => {
        let found = privateBySource.get(source);
        if (found === undefined) {
            found = !isEmitted(source);
            privateBySource.set(source, found);
        }
        return found;
    };
}

function isEmitted(source: Source): boolean {
    const outermostFirst = [...source.sets.map(({ extensions }) => extensions), source.extensions];
    let emitted = true;
    for (const extensions of outermostFirst) {
        const extension = extensions?.[SUGARCUBE_NAMESPACE];
        if (typeof extension === "object" && extension !== null && "emit" in extension) {
            emitted = extension.emit !== false;
        }
    }
    return emitted;
}

function toClamp({ min, max }: FluidRange, viewport: FluidViewport): string {
    const [minSize, maxSize] = [toPixels(min), toPixels(max)];
    if (minSize === maxSize) return `${roundValue(minSize / 16)}rem`;
    return calculateClamp({ minSize, maxSize, minWidth: viewport.min, maxWidth: viewport.max });
}
