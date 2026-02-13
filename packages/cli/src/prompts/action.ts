// Copied from https://github.com/withastro/cli-kit/blob/main/src/prompt/util/action.ts
import type { Key } from "node:readline";

export const action = (key: Key, isSelect: boolean) => {
    if (key.meta && key.name !== "escape") return;

    if (key.ctrl) {
        if (key.name === "a") return "first";
        if (key.name === "c") return "abort";
        if (key.name === "d") return "abort";
        if (key.name === "e") return "last";
        if (key.name === "g") return "reset";
    }

    if (isSelect) {
        if (key.name === "j") return "down";
        if (key.name === "k") return "up";
        if (key.ctrl && key.name === "n") return "down";
        if (key.ctrl && key.name === "p") return "up";
    }

    if (key.name === "return") return "submit";
    if (key.name === "enter") return "submit";
    if (key.name === "backspace") return "delete";
    if (key.name === "delete") return "deleteForward";
    if (key.name === "abort") return "abort";
    if (key.name === "escape") return "exit";
    if (key.name === "tab") return "next";
    if (key.name === "pagedown") return "nextPage";
    if (key.name === "pageup") return "prevPage";
    if (key.name === "home") return "home";
    if (key.name === "end") return "end";

    if (key.name === "up") return "up";
    if (key.name === "down") return "down";
    if (key.name === "right") return "right";
    if (key.name === "left") return "left";

    return false;
};
