import { describe, expect, it } from "vitest";
import { type CSSWriterOptions, toCSSValue, createCSSWriter } from "../../src/css.js";
import type { DesignTokens, Token } from "../../src/index.js";
import { color, one, px, themed, tokenAt } from "./css-tokens.js";

function declare(tokens: DesignTokens, options?: CSSWriterOptions, input = {}) {
    return createCSSWriter(options).getDeclarations(tokens.getPermutation(input));
}

function lines(tokens: DesignTokens, options?: CSSWriterOptions, input = {}): string[] {
    return declare(tokens, options, input).declarations.map(
        ({ name, value }) => `${name}: ${value}`,
    );
}

const modes = themed(
    {
        color: {
            $type: "color",
            neutral: { 50: { $value: "#fafafc" }, 900: { $value: "#1c1c22" } },
            text: { $value: "{color.neutral.900}" },
        },
        gap: { $type: "dimension", $value: px(8) },
    },
    { color: { text: { $value: "{color.neutral.50}" } } },
);

const typography = {
    $type: "typography",
    $value: {
        fontFamily: ["Inter"],
        fontSize: px(16),
        fontWeight: 400,
        letterSpacing: px(0),
        lineHeight: 1.5,
    },
};

describe("createCSSWriter", () => {
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

        it("writes the value of a reference to part of a token, as var() can't name a part", () => {
            const tokens = one({
                border: {
                    $type: "border",
                    $value: { color: color("#000000").$value, width: px(2), style: "solid" },
                },
                outline: { $type: "dimension", $value: { $ref: "#/border/$value/width" } },
            });
            expect(lines(tokens)).toContain("--outline: 2px");
            const outline = declare(tokens).declarations.find(({ name }) => name === "--outline");
            expect(outline?.dependencies).toStrictEqual([]);
        });

        it("says which tokens each declaration's value names with var()", () => {
            const { declarations } = declare(modes, {}, { mode: "dark" });
            const text = declarations.find(({ name }) => name === "--color-text");
            expect(text?.dependencies).toStrictEqual([tokenAt(modes, "color.neutral.50")]);
            expect(text?.token).toBe(tokenAt(modes, "color.text", { mode: "dark" }));
            expect(declarations.find(({ name }) => name === "--gap")?.dependencies).toStrictEqual(
                [],
            );
        });

        it("names custom properties by its naming, in declarations and references alike", () => {
            expect(lines(modes, { naming: { prefix: "ds", delimiter: "_" } })).toContain(
                "--ds_color_text: var(--ds_color_neutral_900)",
            );
        });

        it("declares a typography token once per CSS property, each saying which it holds", () => {
            const tokens = one({
                body: typography,
                quote: { $type: "typography", $value: "{body}" },
            });
            const { declarations } = declare(tokens, {
                naming: { delimiter: "_" },
            });
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
            expect(quote[0]?.dependencies).toStrictEqual([tokenAt(tokens, "body")]);
        });

        it("gives the same declarations each time it is asked for a permutation", () => {
            const writer = createCSSWriter();
            expect(writer.getDeclarations(modes.getPermutation())).toBe(
                writer.getDeclarations(modes.getPermutation()),
            );
        });

        it("lists a token with no value as not written, and writes a reference to it from its value", () => {
            const tokens = one({ broken: color("{nowhere}"), fine: color("#e11d48") });
            const { declarations, undeclared } = declare(tokens);
            expect(declarations.map(({ name }) => name)).toStrictEqual(["--fine"]);
            expect(undeclared).toStrictEqual([
                { token: tokenAt(tokens, "broken"), reason: "no value" },
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
            const { declarations, undeclared } = declare(tokens, { skip });
            expect(declarations.map(({ name }) => name)).toStrictEqual(["--brand", "--edge"]);
            expect(undeclared.map(({ token, reason }) => [token.path, reason])).toStrictEqual([
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
            const { declarations } = declare(mixed, {
                skip: (token) => token.path === "hidden",
            });
            const card = declarations.find(({ name }) => name === "--card");
            expect(card?.value).toBe("var(--gap) solid #000000");
            expect(card?.dependencies).toStrictEqual([tokenAt(mixed, "gap")]);
        });
    });

    describe("value", () => {
        it("writes what the hook returns instead, a string naming no tokens", () => {
            const tokens = one({ gap: { $type: "dimension", $value: px(8) } });
            const { declarations } = declare(tokens, {
                writeValue: () => "clamp(4px, 1vw, 8px)",
            });
            expect(
                declarations.map(({ value, dependencies }) => [value, dependencies]),
            ).toStrictEqual([["clamp(4px, 1vw, 8px)", []]]);
        });

        it("gives the hook the value as written, which it can keep or wrap with write", () => {
            const { declarations } = declare(modes, {
                writeValue: (token, { value, write }) =>
                    token.path === "color.text"
                        ? write`color-mix(in oklch, ${value} 80%, white)`
                        : value,
            });
            const text = declarations.find(({ name }) => name === "--color-text");
            expect(text?.value).toBe("color-mix(in oklch, var(--color-neutral-900) 80%, white)");
            expect(text?.dependencies).toStrictEqual([tokenAt(modes, "color.neutral.900")]);
        });

        it("writes a token placed in write as var(), and records it", () => {
            const gap = tokenAt(modes, "gap");
            const { declarations } = declare(modes, {
                writeValue: (token, { value, write }) =>
                    token.path === "color.text" ? write`${value} ${gap} ${2}` : value,
            });
            const text = declarations.find(({ name }) => name === "--color-text");
            expect(text?.value).toBe("var(--color-neutral-900) var(--gap) 2");
            expect(text?.dependencies).toStrictEqual([tokenAt(modes, "color.neutral.900"), gap]);
        });

        it("refuses a typography token placed in write, which is one custom property per CSS property", () => {
            const tokens = one({
                body: typography,
                gap: { $type: "dimension", $value: px(8) },
            });
            const body = tokenAt(tokens, "body");
            const writer = createCSSWriter({
                writeValue: (token, { value, write }) =>
                    token.path === "gap" ? write`${body}` : value,
            });
            expect(() => writer.getDeclarations(tokens.getPermutation())).toThrow(TypeError);
        });

        it("lists a token as having no value when the hook returns undefined, and writes references to it from its value", () => {
            const tokens = one({
                gap: { $type: "dimension", $value: px(8) },
                space: { $type: "dimension", $value: "{gap}" },
            });
            const { declarations, undeclared } = declare(tokens, {
                writeValue: (token, { value }) => (token.path === "gap" ? undefined : value),
            });
            expect(declarations.map(({ name, value }) => [name, value])).toStrictEqual([
                ["--space", "8px"],
            ]);
            expect(undeclared).toStrictEqual([
                { token: tokenAt(tokens, "gap"), reason: "no value" },
            ]);
        });

        it("asks the hook once for a token the same in two permutations", () => {
            const asked: string[] = [];
            const writer = createCSSWriter({
                writeValue: (token, { value }) => {
                    asked.push(token.path);
                    return value;
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
        const writeFallback: CSSWriterOptions["writeFallback"] = (token, { rewrite }) => {
            if (token.type !== "color") return undefined;
            const hex = rewrite({ colors: "hex" });
            return hex && { value: hex, condition };
        };

        it("declares the fallback, and the value under @supports where it differs", () => {
            const tokens = one({ brand: p3, plain: color("#e11d48") });
            const { declarations } = declare(tokens, { writeFallback });
            expect(
                declarations.map(({ name, value, supports }) => [name, value, supports]),
            ).toStrictEqual([
                ["--brand", "#ff0000", [{ condition, value: "color(display-p3 1 0 0)" }]],
                ["--plain", "#e11d48", undefined],
            ]);
        });

        it("writes a skipped token inside another's value as its value, the fallback chosen by the declaration", () => {
            const tokens = one({ hidden: p3, brand: color("{hidden}") });
            const { declarations } = declare(tokens, {
                skip: (token) => token.path === "hidden",
                writeFallback,
            });
            expect(
                declarations.map(({ name, value, supports }) => [name, value, supports]),
            ).toStrictEqual([
                ["--brand", "#ff0000", [{ condition, value: "color(display-p3 1 0 0)" }]],
            ]);
        });

        it("writes the value another way with rewrite, through the value hook and references alike", () => {
            const tokens = one({
                hidden: p3,
                edge: {
                    $type: "border",
                    $value: { color: "{hidden}", width: px(1), style: "solid" },
                },
            });
            const { declarations } = createCSSWriter({
                skip: (token) => token.path === "hidden",
                writeFallback: (token, { rewrite }) => {
                    const hex = rewrite({ colors: "hex" });
                    return hex && { value: hex, condition };
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
            const writeValue: CSSWriterOptions["writeValue"] = (token, { value }) =>
                token.path === "gap" ? "clamp(4px, 1vw, 8px)" : value;
            expect(lines(tokens, { writeValue, references: "values" })).toStrictEqual([
                "--gap: clamp(4px, 1vw, 8px)",
                "--space: clamp(4px, 1vw, 8px)",
                "--edge: clamp(4px, 1vw, 8px) solid #000000",
            ]);
        });
    });

    describe("written", () => {
        it("gives undefined for a token that isn't there, as toCSSValue does", () => {
            expect(
                createCSSWriter().getValue(modes.getPermutation().getToken("nope")),
            ).toBeUndefined();
        });

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
                dependencies: [],
            });
            expect(createCSSWriter().getValue(tokenAt(modes, "color.text"))).toStrictEqual({
                css: "var(--color-neutral-900)",
                dependencies: [tokenAt(modes, "color.neutral.900")],
            });
            expect(
                createCSSWriter().getValue(tokenAt(one({ x: color("{nowhere}") }), "x")),
            ).toBeUndefined();
        });

        it("agrees with toCSSValue when nothing is passed but references as values", () => {
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
