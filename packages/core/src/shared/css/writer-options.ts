import type { DesignTokens, Source, Token } from "@sugarcube-sh/dtcg";
import type { CSSWriterOptions } from "@sugarcube-sh/dtcg/css";
import type { FluidConfig, InternalConfig } from "../../types/config.js";
import { SUGARCUBE_NAMESPACE } from "../extensions.js";
import { type FluidRange, pixels, readFluid } from "../fluid.js";
import { fallbacksIn, supportsCondition } from "./polyfill.js";
import { calculateClamp, roundValue } from "./utopia.js";

export type SugarcubeWriterOptions = CSSWriterOptions & { skip: (token: Token) => boolean };

/**
 * What sugarcube passes `dtcg/css`'s writer: the config's naming, its private tokens skipped, a
 * fluid dimension written as `clamp()` across the config's viewport, a gradient's stops wrapped in
 * `linear-gradient()`, and with `colorFallbackStrategy: "polyfill"`, a color outside sRGB and HSL
 * falling back to its `hex`.
 *
 * @example
 * const writer = cssWriter(cssWriterOptions(tokens, config));
 * const { declarations } = writer.declarations(tokens.permutation());
 */
export function cssWriterOptions(
    tokens: DesignTokens,
    config: InternalConfig,
): SugarcubeWriterOptions {
    const { prefix, case: casing, delimiter, variableName, transforms } = config.variables;
    const skip = privateTokens();
    return {
        naming: { prefix, case: casing, delimiter, name: variableName },
        skip,
        value: (token, { written, write }) => {
            if (token.type === "dimension") {
                const fluid = readFluid(
                    token.extensions?.[SUGARCUBE_NAMESPACE],
                    tokens.parseOptions,
                );
                if (!fluid.ok) return undefined;
                if (fluid.value) return clamp(fluid.value, transforms.fluid);
            }
            return token.type === "gradient" && !token.getReferenceAt()
                ? write`linear-gradient(${written})`
                : written;
        },
        ...(transforms.colorFallbackStrategy === "polyfill" && {
            fallback: (token, { writtenWith }) => {
                const { spaces } = fallbacksIn(token, skip);
                const hex = spaces.length > 0 ? writtenWith({ colors: "hex" }) : undefined;
                return hex && { written: hex, unless: supportsCondition(spaces) };
            },
        }),
    };
}

function privateTokens(): (token: Token) => boolean {
    const privateFrom = new Map<Source, boolean>();
    return ({ winningDefinition: { source } }) => {
        let found = privateFrom.get(source);
        if (found === undefined) {
            found = !emits(source);
            privateFrom.set(source, found);
        }
        return found;
    };
}

function emits(source: Source): boolean {
    const outermostFirst = [...source.sets.map(({ extensions }) => extensions), source.extensions];
    let emitted = true;
    for (const extensions of outermostFirst) {
        const ours = extensions?.[SUGARCUBE_NAMESPACE];
        if (typeof ours === "object" && ours !== null && "emit" in ours) {
            emitted = ours.emit !== false;
        }
    }
    return emitted;
}

function clamp({ min, max }: FluidRange, viewport: FluidConfig): string {
    const [minSize, maxSize] = [pixels(min), pixels(max)];
    if (minSize === maxSize) return `${roundValue(minSize / 16)}rem`;
    return calculateClamp({ minSize, maxSize, minWidth: viewport.min, maxWidth: viewport.max });
}
