import { exceptionMessages } from "../error-messages.js";
import type { Permutation, Reference, Token } from "../model.js";
import { type CSSValueOptions, type Replacement, type TypographyCSS, toCSSValue } from "./value.js";
import { type CSSNaming, toCustomPropertyName } from "./custom-property.js";

/** A value written as CSS, with the tokens it uses. */
export interface CSSResult {
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
 * write`color-mix(in oklch, ${value} 80%, white)`
 */
export type CSSTemplate = (
    strings: TemplateStringsArray,
    ...parts: readonly (CSSResult | Token | string | number)[]
) => CSSResult;

/**
 * What to declare for browsers that lack a feature.
 *
 * `condition` is the `@supports` condition for the feature, such as `"(color: oklch(0 0 0))"`.
 */
export interface CSSFallback {
    readonly value: CSSResult;
    readonly condition: string;
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
     * writeValue: (token, { value, write }) =>
     *     token.type === "gradient" && !token.getReferenceAt()
     *         ? write`linear-gradient(${value})`
     *         : value
     */
    writeValue?: (
        token: Token,
        tools: { readonly value: CSSResult; readonly write: CSSTemplate },
    ) => CSSResult | string | undefined;
    /**
     * Adds a fallback for browsers that lack a feature.
     *
     * The fallback is declared, and the usual value goes under `@supports`. `rewrite` writes the
     * value with other color settings.
     *
     * @example
     * // A hex fallback for browsers without oklch()
     * writeFallback: (token, { rewrite }) => {
     *     const hex = rewrite({ colors: "hex" });
     *     return hex && { value: hex, condition: "(color: oklch(0 0 0))" };
     * }
     */
    writeFallback?: (
        token: Token,
        tools: {
            readonly value: CSSResult;
            rewrite(options: Pick<CSSValueOptions, "colors">): CSSResult | undefined;
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
export interface CSSUndeclared {
    readonly token: Token;
    readonly reason: "skipped" | "no value";
}

/** A permutation's custom properties, and the tokens that have none. */
export interface CSSDeclarations {
    readonly declarations: readonly CSSDeclaration[];
    readonly undeclared: readonly CSSUndeclared[];
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
    getValue(token: Token | undefined): CSSResult | undefined;
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
    const undeclared: CSSUndeclared[] = [];

    for (const token of permutation.tokens) {
        if (isSkipped(token, options)) {
            undeclared.push({ token, reason: "skipped" });
            continue;
        }

        const result = writer.writeToken(token);
        if (!result) {
            undeclared.push({ token, reason: "no value" });
            continue;
        }

        declarations.push(...declareToken(token, result, options, getWriter));
    }

    return { declarations, undeclared };
}

function declareToken(
    token: Token,
    result: CSSResult,
    options: CSSWriterOptions,
    getWriter: GetWriter,
): CSSDeclaration[] {
    const fallback = options.writeFallback?.(token, {
        value: result,
        rewrite: ({ colors = "components" }) => getWriter(colors).writeToken(token),
    });
    const declared = fallback?.value ?? result;
    const dependencies = fallback
        ? unique([...declared.dependencies, ...result.dependencies])
        : result.dependencies;
    const originalByProperty = new Map(splitByProperty(result.css));

    return splitByProperty(declared.css).map(([cssProperty, value]) => {
        const original = originalByProperty.get(cssProperty);
        const differs = fallback !== undefined && original !== undefined && original !== value;
        const supports = differs ? [{ condition: fallback.condition, value: original }] : undefined;
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
    #results = new Map<Token, CSSResult | undefined>();

    constructor(colors: Colors, options: CSSWriterOptions) {
        this.#colors = colors;
        this.#options = options;
    }

    writeToken(token: Token): CSSResult | undefined {
        return getOrCompute(this.#results, token, () => this.#writeTokenUncached(token));
    }

    #writeTokenUncached(token: Token): CSSResult | undefined {
        const defaultValue = this.#writeDefaultValue(token);
        const { writeValue } = this.#options;
        if (!defaultValue || !writeValue) return defaultValue;

        const custom = writeValue(token, { value: defaultValue, write: this.#template });
        return toCSSResult(custom);
    }

    #writeDefaultValue(token: Token): CSSResult | undefined {
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

    #writeTemplatePart(part: CSSResult | Token | string | number): PartCSS {
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

function toCSSResult(answer: CSSResult | string | undefined): CSSResult | undefined {
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
