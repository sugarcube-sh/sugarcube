// Turns tokens into CSS custom properties, one block per theme. Each block names only the modifier
// it sets, so the themes stack: `<html data-mode="dark" data-brand="ocean">` gets dark's values and
// ocean's at once. A block writes what differs from the blocks before it, and every variable
// referring to that, so a theme set on any element gives the right values there.
import { type DesignTokens } from "@sugarcube-sh/dtcg";
import { getCSSBlocks, toCSS, createCSSWriter } from "@sugarcube-sh/dtcg/css";

declare const tokens: DesignTokens;

const css = toCSS(
    getCSSBlocks(
        tokens,
        [
            { input: {}, selector: ":root" },
            { input: { mode: "dark" }, selector: '[data-mode="dark"]' },
            { input: { brand: "ocean" }, selector: '[data-brand="ocean"]' },
        ],
        { writer: createCSSWriter({ naming: { prefix: "ds" } }) },
    ),
);
row(css);
