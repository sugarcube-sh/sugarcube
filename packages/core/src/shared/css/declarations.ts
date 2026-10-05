import { type Permutation, type Source, type Token, isAlias, token } from "@sugarcube-sh/dtcg";
import { cssVariable } from "@sugarcube-sh/dtcg/css";
import type { FluidConfig, InternalConfig } from "../../types/config.js";
import { SUGARCUBE_NAMESPACE } from "../extensions.js";
import { type Fallbacks, fallbacksIn, supportsCondition } from "./polyfill.js";
import { type ReplacementFor, type Written, renderToken } from "./values.js";

export interface Declaration {
    token: Token;
    name: string;
    property?: string;
    value: string;
    supports?: { condition: string; value: string };
}

export interface Declared {
    declarations: Declaration[];
    undeclared: { token: Token; private: boolean }[];
    missing: Fallbacks["missing"];
}

export interface DeclarationOptions {
    variable: (path: string) => string;
    fluid: FluidConfig;
    polyfill: boolean;
}

export function declarationOptions(config: InternalConfig): DeclarationOptions {
    const { prefix, variableName, transforms } = config.variables;
    return {
        variable: (path) => cssVariable(path, { prefix, name: variableName }),
        fluid: transforms.fluid,
        polyfill: transforms.colorFallbackStrategy === "polyfill",
    };
}

export function declarations(
    permutation: Permutation,
    { variable, fluid, polyfill }: DeclarationOptions,
): Declared {
    const isPrivate = (each: Token) => privateSource(permutation.sources[each.source.index]);
    const writer = (colors: "native" | "hex") => {
        const renderedFor = new Map<Token, Written | undefined>();
        const rendered = (each: Token): Written | undefined => {
            if (!renderedFor.has(each)) {
                renderedFor.set(each, renderToken(each, replacementFor, { fluid, colors }));
            }
            return renderedFor.get(each);
        };
        const replacementFor: ReplacementFor = (ref) => {
            const target = isAlias(ref) ? token(permutation, ref.alias) : undefined;
            const written = target && rendered(target);
            if (!target || written === undefined) return undefined;
            return isPrivate(target) ? { written } : { variable: variable(target.path) };
        };
        return rendered;
    };
    const native = writer("native");
    const fallback = writer("hex");
    const lines = (each: Token, written: Written): Declaration[] => {
        const name = variable(each.path);
        if (typeof written === "string") return [{ token: each, name, value: written }];
        return Object.entries(written).map(([property, value]) => ({
            token: each,
            name: `${name}-${property}`,
            property,
            value,
        }));
    };

    const missing: Fallbacks["missing"] = [];
    const undeclared: Declared["undeclared"] = [];
    const declare = (each: Token): Declaration[] => {
        const hidden = isPrivate(each);
        const written = hidden ? undefined : native(each);
        if (written === undefined) {
            undeclared.push({ token: each, private: hidden });
            return [];
        }
        const found = polyfill ? fallbacksIn(permutation, each, isPrivate) : undefined;
        const plain = found && found.spaces.length > 0 ? fallback(each) : undefined;
        if (found) missing.push(...found.missing);
        if (!found || plain === undefined) return lines(each, written);
        const real = new Map(lines(each, written).map(({ name, value }) => [name, value]));
        const condition = supportsCondition(found.spaces);
        return lines(each, plain).map((line) => {
            const own = real.get(line.name);
            if (own !== undefined && own !== line.value) line.supports = { condition, value: own };
            return line;
        });
    };

    const declared = permutation.tokens.flatMap(declare);
    return { declarations: declared, undeclared, missing };
}

function privateSource(source: Source | undefined): boolean {
    const ours = source?.extensions?.[SUGARCUBE_NAMESPACE];
    return typeof ours === "object" && ours !== null && "emit" in ours && ours.emit === false;
}
