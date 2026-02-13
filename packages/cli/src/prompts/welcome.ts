import { log } from "./log.js";

export const welcome = async () => {
    const messages = ["Welcome to sugarcube — the toolkit for seriously sweet frontends!"];
    log.space(1);
    await log.animated(messages, { clear: false });
};

