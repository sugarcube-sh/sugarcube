import { exceptionMessages } from "../error-messages.js";
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
 * Only place tokens you reach from the token being written, such as
 * `token.getReferenceAt()?.pointsToWholeToken`. A token from one permutation's `getToken` would
 * carry that permutation's value over into the others.
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

type GetWriter = (colors: Colors) => ColorModeWriter;

interface ReferenceCSS {
    readonly replacement: Replacement;
    readonly dependencies: readonly Token[];
}

interface PartCSS {
    readonly css: string;
    readonly dependencies: readonly Token[];
}

interface DeclarationFields {
    readonly token: Token;
    readonly name: string;
    readonly cssProperty: keyof TypographyCSS | undefined;
    readonly value: string;
    readonly supports: CSSDeclaration["supports"];
    readonly dependencies: readonly Token[];
}

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
    const writersByColors = new Map<Colors, ColorModeWriter>();
    const getWriter: GetWriter = (colors) =>
        getOrCompute(writersByColors, colors, () => new ColorModeWriter(colors, options));
    const declarationsByPermutation = new Map<Permutation, CSSDeclarations>();

    return {
        getDeclarations: (permutation) =>
            getOrCompute(declarationsByPermutation, permutation, () =>
                declarePermutation(permutation, options, getWriter),
            ),
        getValue: (token) => (token ? getWriter("components").writeToken(token) : undefined),
    };
}

function declarePermutation(
    permutation: Permutation,
    options: CSSWriterOptions,
    getWriter: GetWriter,
): CSSDeclarations {
    const writer = getWriter("components");
    const declarations: CSSDeclaration[] = [];
    const notWritten: CSSNotWritten[] = [];

    for (const token of permutation.tokens) {
        if (isSkipped(token, options)) {
            notWritten.push({ token, because: "skipped" });
            continue;
        }

        const result = writer.writeToken(token);
        if (!result) {
            notWritten.push({ token, because: "no value" });
            continue;
        }

        declarations.push(...declareToken(token, result, options, getWriter));
    }

    return { declarations, notWritten };
}

function declareToken(
    token: Token,
    result: CSSWritten,
    options: CSSWriterOptions,
    getWriter: GetWriter,
): CSSDeclaration[] {
    const fallback = options.writeFallback?.(token, {
        written: result,
        writeWith: ({ colors = "components" }) => getWriter(colors).writeToken(token),
    });
    const declared = fallback?.written ?? result;
    const dependencies = fallback
        ? unique([...declared.dependencies, ...result.dependencies])
        : result.dependencies;
    const originalByProperty = new Map(splitByProperty(result.css));

    return splitByProperty(declared.css).map(([cssProperty, value]) => {
        const original = originalByProperty.get(cssProperty);
        const differs = fallback !== undefined && original !== undefined && original !== value;
        const supports = differs ? [{ condition: fallback.unless, value: original }] : undefined;
        const name = toCustomPropertyName(token.path, { ...options.naming, cssProperty });
        return toDeclaration({ token, name, cssProperty, value, supports, dependencies });
    });
}

function toDeclaration(fields: DeclarationFields): CSSDeclaration {
    const { token, name, cssProperty, value, supports, dependencies } = fields;
    return {
        token,
        name,
        ...(cssProperty && { cssProperty }),
        value,
        ...(supports && { supports }),
        dependencies,
    };
}

class ColorModeWriter {
    #colors: Colors;
    #options: CSSWriterOptions;
    #results = new Map<Token, CSSWritten | undefined>();

    constructor(colors: Colors, options: CSSWriterOptions) {
        this.#colors = colors;
        this.#options = options;
    }

    writeToken(token: Token): CSSWritten | undefined {
        return getOrCompute(this.#results, token, () => this.#writeTokenUncached(token));
    }

    #writeTokenUncached(token: Token): CSSWritten | undefined {
        const defaultValue = this.#writeDefaultValue(token);
        const { writeValue } = this.#options;
        if (!defaultValue || !writeValue) return defaultValue;

        const custom = writeValue(token, { written: defaultValue, write: this.#template });
        return toCSSResult(custom);
    }

    #writeDefaultValue(token: Token): CSSWritten | undefined {
        if (token.resolved === undefined) return undefined;

        const aliasTarget = token.getReferenceAt()?.pointsToWholeToken;
        if (aliasTarget && this.#isInlined(aliasTarget)) {
            const aliased = this.writeToken(aliasTarget);
            if (aliased) return aliased;
        }

        const dependencies: Token[] = [];
        const replaceReference = (ref: Reference, cssProperty?: keyof TypographyCSS) => {
            const target = ref.pointsToWholeToken;
            if (!target) return undefined;

            const written = this.#writeReference(target, cssProperty);
            if (!written) return undefined;

            dependencies.push(...written.dependencies);
            return written.replacement;
        };

        const css = toCSSValue(token, { replaceReference, colors: this.#colors });
        if (css === undefined) return undefined;
        return { css, dependencies: unique(dependencies) };
    }

    #writeReference(target: Token, cssProperty?: keyof TypographyCSS): ReferenceCSS | undefined {
        const result = this.writeToken(target);
        if (!result) return undefined;

        if (!this.#isInlined(target)) {
            const naming = { ...this.#options.naming, cssProperty };
            const customProperty = toCustomPropertyName(target.path, naming);
            return { replacement: { customProperty }, dependencies: [target] };
        }

        if (typeof result.css !== "string") return undefined;
        return { replacement: { css: result.css }, dependencies: result.dependencies };
    }

    #template: CSSTemplate = (strings, ...parts) => {
        const dependencies: Token[] = [];
        let css = strings[0] ?? "";

        parts.forEach((part, index) => {
            const written = this.#writeTemplatePart(part);
            css += written.css + (strings[index + 1] ?? "");
            dependencies.push(...written.dependencies);
        });

        return { css, dependencies: unique(dependencies) };
    };

    #writeTemplatePart(part: CSSWritten | Token | string | number): PartCSS {
        if (typeof part === "string" || typeof part === "number") {
            return { css: String(part), dependencies: [] };
        }

        if ("css" in part) {
            if (typeof part.css !== "string")
                throw new TypeError(exceptionMessages.typographyNotPlaceable);
            return { css: part.css, dependencies: part.dependencies };
        }

        if (part.type === "typography")
            throw new TypeError(exceptionMessages.typographyNotPlaceable);

        const reference = this.#writeReference(part);
        if (reference) {
            return { css: toCSSText(reference.replacement), dependencies: reference.dependencies };
        }

        const css = toCSSValue(part, { colors: this.#colors });
        if (typeof css !== "string") throw new TypeError(exceptionMessages.typographyNotPlaceable);
        return { css, dependencies: [] };
    }

    #isInlined(token: Token): boolean {
        return this.#options.references === "values" || isSkipped(token, this.#options);
    }
}

function isSkipped(token: Token, options: CSSWriterOptions): boolean {
    return options.skip?.(token) ?? false;
}

function splitByProperty(
    css: string | TypographyCSS,
): [cssProperty: keyof TypographyCSS | undefined, value: string][] {
    if (typeof css === "string") return [[undefined, css]];
    return Object.entries(css) as [keyof TypographyCSS, string][];
}

function toCSSText(replacement: Replacement): string {
    if ("customProperty" in replacement) return `var(${replacement.customProperty})`;
    return replacement.css;
}

function toCSSResult(answer: CSSWritten | string | undefined): CSSWritten | undefined {
    if (typeof answer === "string") return { css: answer, dependencies: [] };
    return answer;
}

function getOrCompute<K, V>(cache: Map<K, V>, key: K, compute: () => V): V {
    if (cache.has(key)) return cache.get(key) as V;

    const value = compute();
    cache.set(key, value);
    return value;
}

function unique(tokens: readonly Token[]): readonly Token[] {
    return tokens.length < 2 ? tokens : [...new Set(tokens)];
}
