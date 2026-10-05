import { type Alias, type Pointer, type Token, referenceAt } from "@sugarcube-sh/dtcg";
import { type Replacement, type TypographyCSS, cssValue } from "@sugarcube-sh/dtcg/css";
import type { FluidConfig } from "../../types/config.js";
import { SUGARCUBE_NAMESPACE } from "../extensions.js";
import { type FluidRange, pixels, readFluid } from "../fluid.js";
import { parseOptions } from "../parse-options.js";
import { calculateClamp, roundValue } from "./utopia.js";

export type Written = string | TypographyCSS;

export type WrittenReplacement = { variable: string } | { written: Written };

export type ReplacementFor = (ref: Alias | Pointer) => WrittenReplacement | undefined;

export function renderToken(
    token: Token,
    replacementFor: ReplacementFor,
    options: { fluid: FluidConfig; colors: "native" | "hex" },
): Written | undefined {
    if (token.resolved === undefined) return undefined;
    if (token.type === "dimension") {
        const fluid = readFluid(token.extensions?.[SUGARCUBE_NAMESPACE], parseOptions);
        if (!fluid.ok) return undefined;
        if (fluid.value) return clamp(fluid.value, options.fluid);
    }

    const whole = referenceAt(token, []);
    const replaced = whole && replacementFor(whole);
    if (replaced && "written" in replaced) return replaced.written;

    const replacement = (ref: Alias | Pointer): Replacement | undefined => {
        const each = replacementFor(ref);
        if (!each || "variable" in each) return each;
        return typeof each.written === "string" ? { css: each.written } : undefined;
    };
    const { colors } = options;
    if (token.type !== "gradient" || replaced) return cssValue(token, { replacement, colors });
    const stops = cssValue(token, { replacement, colors });
    return stops === undefined ? undefined : `linear-gradient(${stops})`;
}

function clamp({ min, max }: FluidRange, viewport: FluidConfig): string {
    const [minSize, maxSize] = [pixels(min), pixels(max)];
    if (minSize === maxSize) return `${roundValue(minSize / 16)}rem`;
    return calculateClamp({ minSize, maxSize, minWidth: viewport.min, maxWidth: viewport.max });
}
