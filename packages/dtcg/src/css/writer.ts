import { thrownMessages } from "../error-messages.js";
import type { Permutation, Reference, Token } from "../index.js";
import { type CSSValueOptions, type Replacement, type TypographyCSS, cssValue } from "./value.js";
import { type CSSNaming, cssCustomProperty } from "./custom-property.js";

/** A value written as CSS, and the tokens it names with `var()`. */
export interface CSSWritten {
    readonly css: string | TypographyCSS;
    readonly refersTo: readonly Token[];
}

/**
 * Writes CSS that refers to tokens: each token placed in it is written as `var()`, or as its value
 * when the writer writes references as values or skips that token, and is recorded in `refersTo`.
 * A {@link CSSWritten} placed in it keeps its own `refersTo`. Typography, one value per CSS
 * property, cannot be placed whole. A token the same in two permutations is one object and is
 * written once, so place tokens reached from the token being written, such as its references,
 * which are right in every permutation it is in; a token looked up in one permutation is that
 * permutation's, which matters when references are written as values.
 *
 * @example
 * write`color-mix(in oklch, ${written} 80%, ${white})`
 */
export type CSSTemplate = (
    strings: TemplateStringsArray,
    ...parts: readonly (CSSWritten | Token | string | number)[]
) => CSSWritten;

/** The value a declaration writes for browsers that do not support the `@supports` condition `unless`. */
export interface CSSFallback {
    readonly written: CSSWritten;
    readonly unless: string;
}

/** The opinions a CSS writer takes; with none, it writes every token as `dtcg` does. */
export interface CSSWriterOptions {
    /** How each token's custom property is named. */
    naming?: CSSNaming;
    /**
     * Writes a token's value another way. It gets the value as written, and `write` for writing CSS
     * that refers to tokens. Its answer is the token's value everywhere: in its declaration, and
     * in any value written with it. `undefined` means the token has no value to write.
     *
     * @example
     * value: (token, { written, write }) =>
     *     token.type === "gradient" && !token.referenceAt() ? write`linear-gradient(${written})` : written
     */
    value?: (
        token: Token,
        tools: { readonly written: CSSWritten; readonly write: CSSTemplate },
    ) => CSSWritten | string | undefined;
    /**
     * What a token's declaration writes for browsers lacking a feature. The fallback is
     * declared, and the value under `@supports` where the two differ. `writtenWith` writes the
     * value with other {@link CSSValueOptions}, through `value` and references alike.
     *
     * @example
     * fallback: (token, { writtenWith }) => {
     *     const hex = writtenWith({ colors: "hex" });
     *     return hex && { written: hex, unless: "(color: oklch(0 0 0))" };
     * }
     */
    fallback?: (
        token: Token,
        tools: {
            readonly written: CSSWritten;
            writtenWith(options: Pick<CSSValueOptions, "colors">): CSSWritten | undefined;
        },
    ) => CSSFallback | undefined;
    /**
     * Leaves a token out: it gets no declaration, and a reference to it is written as its value,
     * since a `var()` to a custom property never declared names nothing.
     */
    skip?: (token: Token) => boolean;
    /**
     * `"values"` writes every reference as its target's value, as the writer writes it, rather
     * than as `var()`: a token's value as a page would compute it, for showing one token alone.
     * @default "custom-properties"
     */
    references?: "custom-properties" | "values";
}

/** One custom property a token declares. */
export interface CSSDeclaration {
    readonly token: Token;
    readonly name: string;
    /** For a typography token, which CSS property this custom property holds. */
    readonly cssProperty?: keyof TypographyCSS;
    readonly value: string;
    /** What to declare instead where a browser supports `condition`. */
    readonly supports?: readonly { readonly condition: string; readonly value: string }[];
    /** The tokens the value or its alternatives name with `var()`. */
    readonly refersTo: readonly Token[];
}

/**
 * A token that declares nothing, and why: `"skipped"` by the writer's `skip`, or `"no value"`,
 * since it has none or the writer's `value` answered `undefined`.
 */
export interface CSSNotWritten {
    readonly token: Token;
    readonly because: "skipped" | "no value";
}

/** A permutation's declarations, and each of its tokens that declares nothing. */
export interface CSSDeclarations {
    readonly declarations: readonly CSSDeclaration[];
    readonly notWritten: readonly CSSNotWritten[];
}

/** Writes tokens as CSS custom properties, each token written once however often it is asked. */
export interface CSSWriter {
    /** Every custom property a permutation declares, in its tokens' order. */
    declarations(permutation: Permutation): CSSDeclarations;
    /** One token's value as this writer writes it, with the tokens it names; `undefined` when it has none. */
    written(token: Token): CSSWritten | undefined;
}

type Colors = NonNullable<CSSValueOptions["colors"]>;

/**
 * A writer of CSS custom properties, taking a tool's opinions as options: how they are
 * named, how a value is written, what a declaration falls back to, which tokens are left out, and
 * whether references are written as `var()` or as values. A token the same in two permutations is
 * the same object, so it is written once. A writer keeps every token it has written, so make one
 * per read.
 *
 * @example
 * const writer = cssWriter({ naming: { prefix: "ds" } });
 * for (const { name, value } of writer.declarations(tokens.permutation()).declarations) {
 *     row(`${name}: ${value};`);
 * }
 *
 * @example
 * // one token's value as a page would compute it
 * cssWriter({ references: "values" }).written(token)
 */
export function cssWriter(options: CSSWriterOptions = {}): CSSWriter {
    const { naming, value, fallback, skip, references = "custom-properties" } = options;
    const skipped = (token: Token) => skip?.(token) ?? false;
    const inlined = (token: Token) => references === "values" || skipped(token);

    const writtenIn = new Map<Colors, Map<Token, CSSWritten | undefined>>();
    const written = (token: Token, colors: Colors): CSSWritten | undefined => {
        let mode = writtenIn.get(colors);
        if (!mode) {
            mode = new Map();
            writtenIn.set(colors, mode);
        }
        if (mode.has(token)) return mode.get(token);
        const plain = asWritten(token, colors);
        const answer =
            plain && value
                ? answered(value(token, { written: plain, write: template(colors) }))
                : plain;
        mode.set(token, answer);
        return answer;
    };

    const refer = (
        target: Token,
        colors: Colors,
        refersTo: Token[],
        cssProperty?: keyof TypographyCSS,
    ): Replacement | undefined => {
        const own = written(target, colors);
        if (!own) return undefined;
        if (!inlined(target)) {
            refersTo.push(target);
            return { customProperty: cssCustomProperty(target.path, { ...naming, cssProperty }) };
        }
        if (typeof own.css !== "string") return undefined;
        refersTo.push(...own.refersTo);
        return { css: own.css };
    };

    const asWritten = (token: Token, colors: Colors): CSSWritten | undefined => {
        if (token.resolved === undefined) return undefined;
        const target = token.referenceAt()?.token;
        if (target && inlined(target)) {
            const own = written(target, colors);
            if (own) return own;
        }
        const refersTo: Token[] = [];
        const replacement = (ref: Reference, cssProperty?: keyof TypographyCSS) =>
            ref.token ? refer(ref.token, colors, refersTo, cssProperty) : undefined;
        const css = cssValue(token, { replacement, colors });
        return css === undefined ? undefined : { css, refersTo: unique(refersTo) };
    };

    const template =
        (colors: Colors): CSSTemplate =>
        (strings, ...parts) => {
            const refersTo: Token[] = [];
            let css = strings[0] ?? "";
            parts.forEach((part, index) => {
                css += placed(part, colors, refersTo) + (strings[index + 1] ?? "");
            });
            return { css, refersTo: unique(refersTo) };
        };

    const placed = (
        part: CSSWritten | Token | string | number,
        colors: Colors,
        refersTo: Token[],
    ): string => {
        if (typeof part === "string" || typeof part === "number") return String(part);
        if ("css" in part) {
            if (typeof part.css !== "string") throw new TypeError(thrownMessages.typographyPlaced);
            refersTo.push(...part.refersTo);
            return part.css;
        }
        if (part.type === "typography") throw new TypeError(thrownMessages.typographyPlaced);
        const answer = refer(part, colors, refersTo);
        if (answer)
            return "customProperty" in answer ? `var(${answer.customProperty})` : answer.css;
        const own = cssValue(part, { colors });
        if (typeof own !== "string") throw new TypeError(thrownMessages.typographyPlaced);
        return own;
    };

    const declare = (token: Token, own: CSSWritten): CSSDeclaration[] => {
        const fell = fallback?.(token, {
            written: own,
            writtenWith: ({ colors = "native" }) => written(token, colors),
        });
        const declared = fell?.written ?? own;
        const refersTo = fell ? unique([...declared.refersTo, ...own.refersTo]) : own.refersTo;
        const line = (
            css: string,
            supported: string | undefined,
            cssProperty?: keyof TypographyCSS,
        ): CSSDeclaration => ({
            token,
            name: cssCustomProperty(token.path, { ...naming, cssProperty }),
            ...(cssProperty && { cssProperty }),
            value: css,
            ...(fell &&
                supported !== undefined &&
                supported !== css && {
                    supports: [{ condition: fell.unless, value: supported }],
                }),
            refersTo,
        });
        if (typeof declared.css === "string") {
            return [line(declared.css, typeof own.css === "string" ? own.css : undefined)];
        }
        const ownCSS = own.css;
        return (Object.entries(declared.css) as [keyof TypographyCSS, string][]).map(
            ([cssProperty, each]) =>
                line(
                    each,
                    typeof ownCSS === "string" ? undefined : ownCSS[cssProperty],
                    cssProperty,
                ),
        );
    };

    const declaredIn = new Map<Permutation, CSSDeclarations>();
    return {
        declarations(permutation) {
            const kept = declaredIn.get(permutation);
            if (kept) return kept;
            const declarations: CSSDeclaration[] = [];
            const notWritten: CSSNotWritten[] = [];
            for (const token of permutation.tokens) {
                if (skipped(token)) {
                    notWritten.push({ token, because: "skipped" });
                    continue;
                }
                const own = written(token, "native");
                if (!own) {
                    notWritten.push({ token, because: "no value" });
                    continue;
                }
                declarations.push(...declare(token, own));
            }
            const declared = { declarations, notWritten };
            declaredIn.set(permutation, declared);
            return declared;
        },
        written(token) {
            return written(token, "native");
        },
    };
}

function answered(answer: CSSWritten | string | undefined): CSSWritten | undefined {
    return typeof answer === "string" ? { css: answer, refersTo: [] } : answer;
}

function unique(tokens: Token[]): Token[] {
    return tokens.length < 2 ? tokens : [...new Set(tokens)];
}
