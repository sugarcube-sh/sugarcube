import color from "picocolors";
import { LINKS } from "../constants/links.js";
import { infoBoxWithBadge } from "./box-with-badge.js";
import { sleep } from "./common.js";
import { log } from "./log.js";

export async function next(): Promise<void> {
    log.space(2);
    await sleep(200);

    const content = `Next steps\n\nRead the docs: ${color.cyan(LINKS.HOMEPAGE)}`;

    infoBoxWithBadge(content, { width: 0.75 });

    await sleep(200);
    log.break(1);
}
