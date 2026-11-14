import {
    type CSSBlockInput,
    type CSSNaming,
    getCSSBlocks,
    toCSS,
    createCSSWriter,
} from "@sugarcube-sh/dtcg/css";
import type { BuildAdapter } from "../controllers/adapter";

export interface PlainSettings {
    readonly naming?: CSSNaming;
    readonly blocks?: readonly CSSBlockInput[];
}

const DEFAULT_BLOCKS: readonly CSSBlockInput[] = [{ input: {}, selector: ":root" }];

export function createPlainAdapter({
    naming,
    blocks = DEFAULT_BLOCKS,
}: PlainSettings = {}): BuildAdapter {
    return {
        readOptions: {},
        write(tokens) {
            const valueWriter = createCSSWriter({ naming, references: "values" });
            return {
                getValue: (token) => valueWriter.getValue(token)?.css,
                css: toCSS(getCSSBlocks(tokens, blocks, { writer: createCSSWriter({ naming }) })),
                problems: tokens.diagnostics,
            };
        },
    };
}
