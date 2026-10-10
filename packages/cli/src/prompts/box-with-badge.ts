import color from "picocolors";
import { box } from "./box.js";
import { log } from "./log.js";

export function errorBoxWithBadge(message: string, options = {}) {
    const paddedMessage = `\n${message}`;

    box(paddedMessage, color.black(color.bgRed(" ERROR ")), {
        width: "auto",
        titlePadding: 2,
        formatBorder: color.red,
        ...options,
    });
}

function warningBoxWithBadge(message: string, options = {}) {
    const paddedMessage = `\n${message}`;

    box(paddedMessage, color.black(color.bgYellow(" WARNING ")), {
        width: "auto",
        titlePadding: 2,
        formatBorder: color.yellow,
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

export function printWarning(message: string, { plain }: { plain: boolean }) {
    if (plain) {
        console.error(message);
        return;
    }
    log.space(1);
    warningBoxWithBadge(message);
}
