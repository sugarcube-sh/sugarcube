import { type Permutation, type Source, type Token, isAlias, token } from "@sugarcube-sh/dtcg";
import type { FluidConfig } from "../../types/config.js";
import { SUGARCUBE_NAMESPACE } from "../extensions.js";
import { type Fallbacks, fallbacksIn, supportsCondition } from "./polyfill.js";
import { type ReplacementFor, type Written, renderToken } from "./values.js";

export interface Declaration {
    path: string;
    name: string;
    value: string;
    supports?: { condition: string; value: string };
}

export interface Declared {
    declarations: Declaration[];
    missing: Fallbacks["missing"];
}

export function declarations(
    permutation: Permutation,
    {
        variable,
        fluid,
        polyfill,
    }: { variable: (path: string) => string; fluid: FluidConfig; polyfill: boolean },
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
    const lines = ({ path }: Token, written: Written): Declaration[] => {
        const name = variable(path);
        if (typeof written === "string") return [{ path, name, value: written }];
        return Object.entries(written).map(([property, value]) => ({
            path,
            name: `${name}-${property}`,
            value,
        }));
    };

    const missing: Fallbacks["missing"] = [];
    const declared = permutation.tokens.flatMap((each) => {
        const written = isPrivate(each) ? undefined : native(each);
        if (written === undefined) return [];
        const found = polyfill ? fallbacksIn(permutation, each, isPrivate) : undefined;
        const plain = found && found.spaces.length > 0 ? fallback(each) : undefined;
        if (found) missing.push(...found.missing);
        if (!found || plain === undefined) return lines(each, written);
        const real = new Map(lines(each, written).map(({ name, value }) => [name, value]));
        const condition = supportsCondition(found.spaces);
        return lines(each, plain).map(({ path, name, value }) => {
            const own = real.get(name);
            return own === undefined || own === value
                ? { path, name, value }
                : { path, name, value, supports: { condition, value: own } };
        });
    });
    return { declarations: declared, missing };
}

function privateSource(source: Source | undefined): boolean {
    const ours = source?.extensions?.[SUGARCUBE_NAMESPACE];
    return typeof ours === "object" && ours !== null && "emit" in ours && ours.emit === false;
}
