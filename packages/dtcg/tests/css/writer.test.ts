import { describe, expect, it } from "vitest";
import { type CSSWriterOptions, toCSSValue, createCSSWriter } from "../../src/css.js";
import { type DesignTokens, type Token, readFromMemory } from "../../src/index.js";

const px = (value: number) => ({ value, unit: "px" });
const color = (value: unknown) => ({ $type: "color", $value: value });

function read(files: Record<string, unknown>): DesignTokens {
    const texts = Object.fromEntries(
        Object.entries(files).map(([path, json]) => [path, JSON.stringify(json)]),
    );
    return readFromMemory({ files: texts }, { hexStringColors: true });
}

function one(json: Record<string, unknown>): DesignTokens {
    return read({ "tokens.json": json });
}

function lines(tokens: DesignTokens, options?: CSSWriterOptions, input = {}): string[] {
    const { declarations } = createCSSWriter(options).getDeclarations(tokens.getPermutation(input));
    return declarations.map(({ name, value }) => `${name}: ${value}`);
}

function tokenAt(tokens: DesignTokens, path: string, input = {}): Token {
    const found = tokens.getPermutation(input).getToken(path);
    if (!found) throw new Error(`no token at ${path}`);
    return found;
}

const modes = read({
    "tokens.resolver.json": {
        version: "2025.10",
        resolutionOrder: [
            { type: "set", name: "base", sources: [{ $ref: "base.json" }] },
            {
                type: "modifier",
                name: "mode",
                default: "light",
                contexts: { light: [], dark: [{ $ref: "dark.json" }] },
            },
        ],
    },
    "base.json": {
        color: {
            $type: "color",
            neutral: { 50: { $value: "#fafafc" }, 900: { $value: "#1c1c22" } },
            text: { $value: "{color.neutral.900}" },
        },
        gap: { $type: "dimension", $value: px(8) },
    },
    "dark.json": { color: { text: { $value: "{color.neutral.50}" } } },
});

describe("cssWriter", () => {
    describe("declarations", () => {
        it("gives every custom property a permutation declares, a reference as var()", () => {
            expect(lines(modes)).toStrictEqual([
                "--color-neutral-50: #fafafc",
                "--color-neutral-900: #1c1c22",
                "--color-text: var(--color-neutral-900)",
                "--gap: 8px",
            ]);
            expect(lines(modes, {}, { mode: "dark" })).toContain(
                "--color-text: var(--color-neutral-50)",
            );
        });

        it("says which tokens each declaration's value names with var()", () => {
            const { declarations } = createCSSWriter().getDeclarations(
                modes.getPermutation({ mode: "dark" }),
            );
            const text = declarations.find(({ name }) => name === "--color-text");
            expect(text?.refersTo).toStrictEqual([tokenAt(modes, "color.neutral.50")]);
            expect(text?.token).toBe(tokenAt(modes, "color.text", { mode: "dark" }));
            expect(declarations.find(({ name }) => name === "--gap")?.refersTo).toStrictEqual([]);
        });

        it("names custom properties by its naming, in declarations and references alike", () => {
            expect(lines(modes, { naming: { prefix: "ds", delimiter: "_" } })).toContain(
                "--ds_color_text: var(--ds_color_neutral_900)",
            );
        });

        it("declares a typography token once per CSS property, each saying which it holds", () => {
            const tokens = one({
                body: {
                    $type: "typography",
                    $value: {
                        fontFamily: ["Inter"],
                        fontSize: px(16),
                        fontWeight: 400,
                        letterSpacing: px(0),
                        lineHeight: 1.5,
                    },
                },
                quote: { $type: "typography", $value: "{body}" },
            });
            const { declarations } = createCSSWriter({
                naming: { delimiter: "_" },
            }).getDeclarations(tokens.getPermutation());
            const quote = declarations.filter(({ token }) => token.path === "quote");
            expect(
                quote.map(({ name, cssProperty, value }) => [name, cssProperty, value]),
            ).toStrictEqual([
                ["--quote_font-family", "font-family", "var(--body_font-family)"],
                ["--quote_font-size", "font-size", "var(--body_font-size)"],
                ["--quote_font-weight", "font-weight", "var(--body_font-weight)"],
                ["--quote_letter-spacing", "letter-spacing", "var(--body_letter-spacing)"],
                ["--quote_line-height", "line-height", "var(--body_line-height)"],
            ]);
            expect(quote[0]?.refersTo).toStrictEqual([tokenAt(tokens, "body")]);
        });

        it("gives the same declarations each time it is asked for a permutation", () => {
            const writer = createCSSWriter();
            expect(writer.getDeclarations(modes.getPermutation())).toBe(
                writer.getDeclarations(modes.getPermutation()),
            );
        });

        it("lists a token with no value as not written, and writes a reference to it from its value", () => {
            const tokens = one({ broken: color("{nowhere}"), fine: color("#e11d48") });
            const { declarations, notWritten } = createCSSWriter().getDeclarations(
                tokens.getPermutation(),
            );
            expect(declarations.map(({ name }) => name)).toStrictEqual(["--fine"]);
            expect(notWritten).toStrictEqual([
                { token: tokenAt(tokens, "broken"), because: "no value" },
            ]);
        });
    });

    describe("skip", () => {
        const tokens = one({
            palette: { rose: color("#e11d48"), ink: color("{palette.rose}") },
            brand: color("{palette.ink}"),
            edge: {
                $type: "border",
                $value: { color: "{palette.rose}", width: px(1), style: "solid" },
            },
        });
        const skip = (token: Token) => token.path.startsWith("palette.");

        it("declares nothing for a skipped token, and lists it as skipped", () => {
            const { declarations, notWritten } = createCSSWriter({ skip }).getDeclarations(
                tokens.getPermutation(),
            );
            expect(declarations.map(({ name }) => name)).toStrictEqual(["--brand", "--edge"]);
            expect(notWritten.map(({ token, because }) => [token.path, because])).toStrictEqual([
                ["palette.rose", "skipped"],
                ["palette.ink", "skipped"],
            ]);
        });

        it("writes a reference to a skipped token as its value, through every step", () => {
            expect(lines(tokens, { skip })).toStrictEqual([
                "--brand: #e11d48",
                "--edge: 1px solid #e11d48",
            ]);
        });

        it("carries what a skipped token's value names with var() to whatever writes it", () => {
            const mixed = one({
                gap: { $type: "dimension", $value: px(8) },
                hidden: {
                    $type: "border",
                    $value: { color: "#000000", width: "{gap}", style: "solid" },
                },
                card: { $type: "border", $value: "{hidden}" },
            });
            const { declarations } = createCSSWriter({
                skip: (token) => token.path === "hidden",
            }).getDeclarations(mixed.getPermutation());
            const card = declarations.find(({ name }) => name === "--card");
            expect(card?.value).toBe("var(--gap) solid #000000");
            expect(card?.refersTo).toStrictEqual([tokenAt(mixed, "gap")]);
        });
    });

    describe("value", () => {
        it("writes what the hook returns instead, a string naming no tokens", () => {
            const tokens = one({ gap: { $type: "dimension", $value: px(8) } });
            const { declarations } = createCSSWriter({
                writeValue: () => "clamp(4px, 1vw, 8px)",
            }).getDeclarations(tokens.getPermutation());
            expect(declarations.map(({ value, refersTo }) => [value, refersTo])).toStrictEqual([
                ["clamp(4px, 1vw, 8px)", []],
            ]);
        });

        it("gives the hook the value as written, which it can keep or wrap with write", () => {
            const { declarations } = createCSSWriter({
                writeValue: (token, { written, write }) =>
                    token.path === "color.text"
                        ? write`color-mix(in oklch, ${written} 80%, white)`
                        : written,
            }).getDeclarations(modes.getPermutation());
            const text = declarations.find(({ name }) => name === "--color-text");
            expect(text?.value).toBe("color-mix(in oklch, var(--color-neutral-900) 80%, white)");
            expect(text?.refersTo).toStrictEqual([tokenAt(modes, "color.neutral.900")]);
        });

        it("writes a token placed in write as var(), and records it", () => {
            const gap = tokenAt(modes, "gap");
            const { declarations } = createCSSWriter({
                writeValue: (token, { written, write }) =>
                    token.path === "color.text" ? write`${written} ${gap} ${2}` : written,
            }).getDeclarations(modes.getPermutation());
            const text = declarations.find(({ name }) => name === "--color-text");
            expect(text?.value).toBe("var(--color-neutral-900) var(--gap) 2");
            expect(text?.refersTo).toStrictEqual([tokenAt(modes, "color.neutral.900"), gap]);
        });

        it("refuses a typography token placed in write, which is one custom property per CSS property", () => {
            const tokens = one({
                body: {
                    $type: "typography",
                    $value: {
                        fontFamily: ["Inter"],
                        fontSize: px(16),
                        fontWeight: 400,
                        letterSpacing: px(0),
                        lineHeight: 1.5,
                    },
                },
                gap: { $type: "dimension", $value: px(8) },
            });
            const body = tokenAt(tokens, "body");
            const writer = createCSSWriter({
                writeValue: (token, { written, write }) =>
                    token.path === "gap" ? write`${body}` : written,
            });
            expect(() => writer.getDeclarations(tokens.getPermutation())).toThrow(TypeError);
        });

        it("lists a token as having no value when the hook returns undefined, and writes references to it from its value", () => {
            const tokens = one({
                gap: { $type: "dimension", $value: px(8) },
                space: { $type: "dimension", $value: "{gap}" },
            });
            const { declarations, notWritten } = createCSSWriter({
                writeValue: (token, { written }) => (token.path === "gap" ? undefined : written),
            }).getDeclarations(tokens.getPermutation());
            expect(declarations.map(({ name, value }) => [name, value])).toStrictEqual([
                ["--space", "8px"],
            ]);
            expect(notWritten).toStrictEqual([
                { token: tokenAt(tokens, "gap"), because: "no value" },
            ]);
        });

        it("asks the hook once for a token the same in two permutations", () => {
            const asked: string[] = [];
            const writer = createCSSWriter({
                writeValue: (token, { written }) => {
                    asked.push(token.path);
                    return written;
                },
            });
            writer.getDeclarations(modes.getPermutation());
            writer.getDeclarations(modes.getPermutation({ mode: "dark" }));
            expect(asked.filter((path) => path === "gap")).toStrictEqual(["gap"]);
            expect(asked.filter((path) => path === "color.text")).toStrictEqual([
                "color.text",
                "color.text",
            ]);
        });
    });

    describe("fallback", () => {
        const p3 = color({ colorSpace: "display-p3", components: [1, 0, 0], hex: "#ff0000" });
        const condition = "(color: color(display-p3 1 1 1))";
        const writeFallback: CSSWriterOptions["writeFallback"] = (token, { writeWith }) => {
            if (token.type !== "color") return undefined;
            const hex = writeWith({ colors: "hex" });
            return hex && { written: hex, unless: condition };
        };

        it("declares the fallback, and the value under @supports where it differs", () => {
            const tokens = one({ brand: p3, plain: color("#e11d48") });
            const { declarations } = createCSSWriter({ writeFallback }).getDeclarations(
                tokens.getPermutation(),
            );
            expect(
                declarations.map(({ name, value, supports }) => [name, value, supports]),
            ).toStrictEqual([
                ["--brand", "#ff0000", [{ condition, value: "color(display-p3 1 0 0)" }]],
                ["--plain", "#e11d48", undefined],
            ]);
        });

        it("writes a skipped token inside another's value as its value, the fallback chosen by the declaration", () => {
            const tokens = one({ hidden: p3, brand: color("{hidden}") });
            const { declarations } = createCSSWriter({
                skip: (token) => token.path === "hidden",
                writeFallback,
            }).getDeclarations(tokens.getPermutation());
            expect(
                declarations.map(({ name, value, supports }) => [name, value, supports]),
            ).toStrictEqual([
                ["--brand", "#ff0000", [{ condition, value: "color(display-p3 1 0 0)" }]],
            ]);
        });

        it("writes the value another way with writtenWith, through the value hook and references alike", () => {
            const tokens = one({
                hidden: p3,
                edge: {
                    $type: "border",
                    $value: { color: "{hidden}", width: px(1), style: "solid" },
                },
            });
            const { declarations } = createCSSWriter({
                skip: (token) => token.path === "hidden",
                writeFallback: (token, { writeWith }) => {
                    const hex = writeWith({ colors: "hex" });
                    return hex && { written: hex, unless: condition };
                },
            }).getDeclarations(tokens.getPermutation());
            expect(declarations.map(({ value }) => value)).toStrictEqual(["1px solid #ff0000"]);
        });
    });

    describe("references: values", () => {
        it("writes every reference as its target's value, through the hook", () => {
            const tokens = one({
                gap: { $type: "dimension", $value: px(8) },
                space: { $type: "dimension", $value: "{gap}" },
                edge: {
                    $type: "border",
                    $value: { color: "#000000", width: "{gap}", style: "solid" },
                },
            });
            const writeValue: CSSWriterOptions["writeValue"] = (token, { written }) =>
                token.path === "gap" ? "clamp(4px, 1vw, 8px)" : written;
            expect(lines(tokens, { writeValue, references: "values" })).toStrictEqual([
                "--gap: clamp(4px, 1vw, 8px)",
                "--space: clamp(4px, 1vw, 8px)",
                "--edge: clamp(4px, 1vw, 8px) solid #000000",
            ]);
        });
    });

    describe("written", () => {
        it("writes references as custom properties when asked by name, as it does by default", () => {
            const token = tokenAt(modes, "color.text");
            expect(
                createCSSWriter({ references: "custom-properties" }).getValue(token),
            ).toStrictEqual(createCSSWriter().getValue(token));
        });

        it("gives one token's value as the writer writes it, with the tokens it names", () => {
            const writer = createCSSWriter({ references: "values" });
            expect(writer.getValue(tokenAt(modes, "color.text", { mode: "dark" }))).toStrictEqual({
                css: "#fafafc",
                refersTo: [],
            });
            expect(createCSSWriter().getValue(tokenAt(modes, "color.text"))).toStrictEqual({
                css: "var(--color-neutral-900)",
                refersTo: [tokenAt(modes, "color.neutral.900")],
            });
            expect(
                createCSSWriter().getValue(tokenAt(one({ x: color("{nowhere}") }), "x")),
            ).toBeUndefined();
        });

        it("agrees with cssValue when nothing is passed but references as values", () => {
            const tokens = one({
                gap: { $type: "dimension", $value: px(8) },
                space: { $type: "dimension", $value: "{gap}" },
            });
            const space = tokenAt(tokens, "space");
            expect(createCSSWriter({ references: "values" }).getValue(space)?.css).toBe(
                toCSSValue(space),
            );
        });
    });
});
