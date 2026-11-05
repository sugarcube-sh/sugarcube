import { thrownMessages } from "../error-messages.js";
import type { Permutation, Reference, Token } from "../model.js";
import { type CSSValueOptions, type Replacement, type TypographyCSS, toCSSValue } from "./value.js";
import { type CSSNaming, toCustomPropertyName } from "./custom-property.js";

/** A value written as CSS, with the tokens it uses. */
export interface CSSWritten {
    readonly css: string | TypographyCSS;
    readonly dependencies: readonly Token[];
}

/**
 * Writes CSS that uses tokens.
 *
 * Each token placed in it becomes a `var()`, and goes in `dependencies`.
 *
 * What you write is used in every permutation the token being written is in. So only place tokens
 * you reach from it, such as `token.getReferenceAt()?.pointsToToken`. A token from one
 * permutation's `getToken` can carry that permutation's value into the others.
 *
 * @example
 * // Mix the token's value with white
 * write`color-mix(in oklch, ${written} 80%, white)`
 */
export type CSSTemplate = (
    strings: TemplateStringsArray,
    ...parts: readonly (CSSWritten | Token | string | number)[]
) => CSSWritten;

/**
 * What to declare for browsers that lack a feature.
 *
 * `unless` is the `@supports` condition for the feature, such as `"(color: oklch(0 0 0))"`.
 */
export interface CSSFallback {
    readonly written: CSSWritten;
    readonly unless: string;
}

/**
 * How a CSS writer writes tokens.
 *
 * With none, every token gets a custom property, and references are written as `var()`.
 */
export interface CSSWriterOptions {
    /** How each token's custom property is named. */
    naming?: CSSNaming;
    /**
     * Writes a token's value your own way.
     *
     * It gets the value as it would be written, and `write` for CSS that uses other tokens. What it
     * returns is used everywhere the token's value is.
     *
     * @example
     * // Wrap a gradient's stops in linear-gradient()
     * writeValue: (token, { written, write }) =>
     *     token.type === "gradient" && !token.getReferenceAt()
     *         ? write`linear-gradient(${written})`
     *         : written
     */
    writeValue?: (
        token: Token,
        tools: { readonly written: CSSWritten; readonly write: CSSTemplate },
    ) => CSSWritten | string | undefined;
    /**
     * Adds a fallback for browsers that lack a feature.
     *
     * The fallback is declared, and the usual value goes under `@supports`. `writeWith` writes the
     * value with other color settings.
     *
     * @example
     * // A hex fallback for browsers without oklch()
     * writeFallback: (token, { writeWith }) => {
     *     const hex = writeWith({ colors: "hex" });
     *     return hex && { written: hex, unless: "(color: oklch(0 0 0))" };
     * }
     */
    writeFallback?: (
        token: Token,
        tools: {
            readonly written: CSSWritten;
            writeWith(options: Pick<CSSValueOptions, "colors">): CSSWritten | undefined;
        },
    ) => CSSFallback | undefined;
    /**
     * Leaves a token out.
     *
     * It gets no custom property, and references to it are written as its value.
     */
    skip?: (token: Token) => boolean;
    /**
     * How references are written.
     *
     * `"custom-properties"` writes them as `var()`.
     * `"values"` writes the value they point to, as a page would compute it.
     *
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
    /** The tokens its values refer to with `var()`. */
    readonly dependencies: readonly Token[];
}

/**
 * A token that declares nothing, and why.
 *
 * `"skipped"` means `skip` left it out.
 * `"no value"` means it has none, or `writeValue` returned `undefined`.
 */
export interface CSSNotWritten {
    readonly token: Token;
    readonly because: "skipped" | "no value";
}

/** A permutation's custom properties, and the tokens that have none. */
export interface CSSDeclarations {
    readonly declarations: readonly CSSDeclaration[];
    readonly notWritten: readonly CSSNotWritten[];
}

/**
 * Writes tokens as CSS custom properties.
 *
 * It writes each token once, however often you ask. So make a new one for each read.
 */
export interface CSSWriter {
    /**
     * Gives every custom property a permutation declares, in token order.
     *
     * @param permutation - A permutation, such as `tokens.getPermutation({ mode: "dark" })`.
     */
    getDeclarations(permutation: Permutation): CSSDeclarations;
    /**
     * Gives one token's value as this writer writes it.
     *
     * It returns `undefined` for no token, or a token with no value.
     *
     * @param token - A token, such as `permutation.getToken("button.background")`.
     *
     * @example
     * // button.background refers to color.primary
     * createCSSWriter().getValue(light.getToken("button.background"))?.css
     * // => "var(--color-primary)"
     */
    getValue(token: Token | undefined): CSSWritten | undefined;
}

type Colors = NonNullable<CSSValueOptions["colors"]>;

/**
 * Makes a CSS writer with your own settings.
 *
 * Pass it to {@link getCSSBlocks}.
 *
 * @param options - How to name, write and leave out tokens, such as `{ naming: { prefix: "ds" } }`.
 *
 * @example
 * // Put "ds" before every name
 * createCSSWriter({ naming: { prefix: "ds" } }).getValue(light.getToken("button.background"))?.css
 * // => "var(--ds-color-primary)"
 */
export function createCSSWriter(options: CSSWriterOptions = {}): CSSWriter {
    const { naming, writeValue, writeFallback, skip, references = "custom-properties" } = options;
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
            plain && writeValue
                ? answered(writeValue(token, { written: plain, write: template(colors) }))
                : plain;
        mode.set(token, answer);
        return answer;
    };

    const refer = (
        target: Token,
        colors: Colors,
        dependencies: Token[],
        cssProperty?: keyof TypographyCSS,
    ): Replacement | undefined => {
        const own = written(target, colors);
        if (!own) return undefined;
        if (!inlined(target)) {
            dependencies.push(target);
            return {
                customProperty: toCustomPropertyName(target.path, { ...naming, cssProperty }),
            };
        }
        if (typeof own.css !== "string") return undefined;
        dependencies.push(...own.dependencies);
        return { css: own.css };
    };

    const asWritten = (token: Token, colors: Colors): CSSWritten | undefined => {
        if (token.resolved === undefined) return undefined;
        const target = token.getReferenceAt()?.pointsToToken;
        if (target && inlined(target)) {
            const own = written(target, colors);
            if (own) return own;
        }
        const dependencies: Token[] = [];
        const replaceReference = (ref: Reference, cssProperty?: keyof TypographyCSS) =>
            ref.pointsToToken
                ? refer(ref.pointsToToken, colors, dependencies, cssProperty)
                : undefined;
        const css = toCSSValue(token, { replaceReference, colors });
        return css === undefined ? undefined : { css, dependencies: unique(dependencies) };
    };

    const template =
        (colors: Colors): CSSTemplate =>
        (strings, ...parts) => {
            const dependencies: Token[] = [];
            let css = strings[0] ?? "";
            parts.forEach((part, index) => {
                css += placed(part, colors, dependencies) + (strings[index + 1] ?? "");
            });
            return { css, dependencies: unique(dependencies) };
        };

    const placed = (
        part: CSSWritten | Token | string | number,
        colors: Colors,
        dependencies: Token[],
    ): string => {
        if (typeof part === "string" || typeof part === "number") return String(part);
        if ("css" in part) {
            if (typeof part.css !== "string") throw new TypeError(thrownMessages.typographyPlaced);
            dependencies.push(...part.dependencies);
            return part.css;
        }
        if (part.type === "typography") throw new TypeError(thrownMessages.typographyPlaced);
        const answer = refer(part, colors, dependencies);
        if (answer)
            return "customProperty" in answer ? `var(${answer.customProperty})` : answer.css;
        const own = toCSSValue(part, { colors });
        if (typeof own !== "string") throw new TypeError(thrownMessages.typographyPlaced);
        return own;
    };

    const declare = (token: Token, own: CSSWritten): CSSDeclaration[] => {
        const fell = writeFallback?.(token, {
            written: own,
            writeWith: ({ colors = "components" }) => written(token, colors),
        });
        const declared = fell?.written ?? own;
        const dependencies = fell
            ? unique([...declared.dependencies, ...own.dependencies])
            : own.dependencies;
        const line = (
            css: string,
            supported: string | undefined,
            cssProperty?: keyof TypographyCSS,
        ): CSSDeclaration => ({
            token,
            name: toCustomPropertyName(token.path, { ...naming, cssProperty }),
            ...(cssProperty && { cssProperty }),
            value: css,
            ...(fell &&
                supported !== undefined &&
                supported !== css && {
                    supports: [{ condition: fell.unless, value: supported }],
                }),
            dependencies,
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
        getDeclarations(permutation) {
            const kept = declaredIn.get(permutation);
            if (kept) return kept;
            const declarations: CSSDeclaration[] = [];
            const notWritten: CSSNotWritten[] = [];
            for (const token of permutation.tokens) {
                if (skipped(token)) {
                    notWritten.push({ token, because: "skipped" });
                    continue;
                }
                const own = written(token, "components");
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
        getValue(token) {
            return token && written(token, "components");
        },
    };
}

function answered(answer: CSSWritten | string | undefined): CSSWritten | undefined {
    return typeof answer === "string" ? { css: answer, dependencies: [] } : answer;
}

function unique(tokens: Token[]): Token[] {
    return tokens.length < 2 ? tokens : [...new Set(tokens)];
}
