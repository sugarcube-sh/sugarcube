import color from "picocolors";
import { box } from "./box.js";

export function errorBoxWithBadge(message: string, options = {}) {
    const paddedMessage = `\n${message}`;

    box(paddedMessage, color.black(color.bgRed(" ERROR ")), {
        width: "auto",
        titlePadding: 2,
        formatBorder: color.red,
        ...options,
    });
}

export function warningBoxWithBadge(message: string, options = {}) {
    const paddedMessage = `\n${message}`;

    box(paddedMessage, color.black(color.bgYellow(" WARNING ")), {
        width: "auto",
        titlePadding: 2,
        formatBorder: color.yellow,
        ...options,
    });
}

function successBoxWithBadge(message: string, options = {}) {
    const paddedMessage = `\n${message}`;

    box(paddedMessage, color.black(color.bgGreen(" SUCCESS ")), {
        width: "auto",
        titlePadding: 2,
        formatBorder: color.green,
        ...options,
    });
}

export function infoBoxWithBadge(message: string, options = {}) {
    const paddedMessage = `\n${message}`;

    box(paddedMessage, color.black(color.bgCyan(" INFO ")), {
        width: "auto",
        titlePadding: 2,
        formatBorder: color.cyan,
        ...options,
    });
}
