// Lightly modified from https://github.com/bombshell-dev/clack/blob/main/packages/prompts/src/common.ts

import type { Readable, Writable } from "node:stream";
import isUnicodeSupported from "is-unicode-supported";
import color from "picocolors";

export interface CommonOptions {
    input?: Readable;
    output?: Writable;
    signal?: AbortSignal;
}

const unicode = isUnicodeSupported();
const unicodeOr = (c: string, fallback: string) => (unicode ? c : fallback);
export const S_STEP_SUBMIT = unicodeOr("◇", "o");

export const S_BAR_START = unicodeOr("┌", "T");
export const S_BAR = unicodeOr("│", "|");
export const S_BAR_END = unicodeOr("└", "—");
export const S_BAR_START_RIGHT = unicodeOr("┐", "T");
export const S_BAR_END_RIGHT = unicodeOr("┘", "—");

export const S_BAR_H = unicodeOr("─", "-");
export const S_CORNER_TOP_RIGHT = unicodeOr("╮", "+");
export const S_CORNER_BOTTOM_RIGHT = unicodeOr("╯", "+");
export const S_CORNER_BOTTOM_LEFT = unicodeOr("╰", "+");
export const S_CORNER_TOP_LEFT = unicodeOr("╭", "+");

export const S_INFO = unicodeOr("●", "•");
export const S_SUCCESS = unicodeOr("◆", "*");
export const S_WARN = unicodeOr("▲", "!");
export const S_ERROR = unicodeOr("■", "x");

export const label = (text: string, c = color.bgGreen, t = color.black) => c(` ${t(text)} `);

export const strip = (str: string) => {
    const pattern = [
        "[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)",
        "(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PRZcf-ntqry=><~]))",
    ].join("|");

    const RGX = new RegExp(pattern, "g");
    return typeof str === "string" ? str.replace(RGX, "") : str;
};

export const intro = (title = "", opts?: CommonOptions) => {
    const output: Writable = opts?.output ?? process.stdout;
    output.write(`\n\n${color.gray(S_BAR_START)}${color.gray(S_BAR_H)} ${title}\n`);
};

export const outro = (message = "", opts?: CommonOptions) => {
    const output: Writable = opts?.output ?? process.stdout;
    output.write(
        `${color.gray(S_BAR)}\n${color.gray(S_BAR_END)}${color.gray(S_BAR_H)}  ${message}\n\n`
    );
};

export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
