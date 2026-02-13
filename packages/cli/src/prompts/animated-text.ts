import readline from "node:readline";
import { createLogUpdate } from "log-update";
import color from "picocolors";
import { action } from "./action.js";

const randomBetween = (min: number, max: number) =>
    Math.floor(Math.random() * (max - min + 1)) + min;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const sayAnimated = async (
    messages: string[],
    options: {
        clear?: boolean;
        stdin?: NodeJS.ReadStream;
        stdout?: NodeJS.WriteStream;
    } = {}
) => {
    const { clear = false, stdin = process.stdin, stdout = process.stdout } = options;

    const rl = readline.createInterface({ input: stdin, escapeCodeTimeout: 50 });
    const logUpdate = createLogUpdate(stdout, { showCursor: false });
    readline.emitKeypressEvents(stdin, rl);

    let i = 0;
    let cancelled = false;

    const done = async () => {
        stdin.off("keypress", handleKeyPress);
        if (stdin.isTTY) stdin.setRawMode(false);
        rl.close();
        cancelled = true;
        if (i < messages.length - 1) {
            logUpdate.clear();
        } else if (clear) {
            logUpdate.clear();
        } else {
            logUpdate.done();
        }
    };

    const handleKeyPress = (str: string, key: any) => {
        if (stdin.isTTY) stdin.setRawMode(true);
        const k = action(key, false);
        if (k === "abort") {
            done();
            return process.exit(0);
        }
        if (["up", "down", "left", "right"].includes(k as any)) return;
        done();
    };

    if (stdin.isTTY) stdin.setRawMode(true);
    stdin.on("keypress", handleKeyPress);

    for (const message of messages) {
        const _message = Array.isArray(message) ? message : message.split(" ");
        const msg: string[] = [];

        for (const word of [""].concat(_message)) {
            if (word) msg.push(word);

            const styledMessage = msg
                .join(" ")
                .replace(/sugarcube/g, color.cyanBright("sugarcube"));

            logUpdate(`${styledMessage}`);

            if (!cancelled) await sleep(randomBetween(75, 200));
        }

        if (!cancelled) await sleep(100);

        const finalMessage = await Promise.all(_message).then((res) => res.join(" "));
        const styledFinalMessage = finalMessage.replace(
            /sugarcube/g,
            color.cyanBright("sugarcube")
        );

        logUpdate(`${styledFinalMessage}`);
        if (!cancelled) await sleep(randomBetween(1200, 1400));
        i++;
    }

    stdin.off("keypress", handleKeyPress);
    await sleep(100);
    done();
    if (stdin.isTTY) stdin.setRawMode(false);
    stdin.removeAllListeners("keypress");
};

export const sayAnimatedInSidebar = async (
    messages: string[],
    options: {
        sidebarSymbol?: string;
        clear?: boolean;
        stdin?: NodeJS.ReadStream;
        stdout?: NodeJS.WriteStream;
    } = {}
) => {
    const {
        sidebarSymbol = color.gray("│"),
        clear = false,
        stdin = process.stdin,
        stdout = process.stdout,
    } = options;

    const rl = readline.createInterface({ input: stdin, escapeCodeTimeout: 50 });
    const logUpdate = createLogUpdate(stdout, { showCursor: false });
    readline.emitKeypressEvents(stdin, rl);

    let i = 0;
    let cancelled = false;

    const done = async () => {
        stdin.off("keypress", handleKeyPress);
        if (stdin.isTTY) stdin.setRawMode(false);
        rl.close();
        cancelled = true;
        if (i < messages.length - 1) {
            logUpdate.clear();
        } else if (clear) {
            logUpdate.clear();
        } else {
            logUpdate.done();
        }
    };

    const handleKeyPress = (str: string, key: any) => {
        if (stdin.isTTY) stdin.setRawMode(true);
        const k = action(key, false);
        if (k === "abort") {
            done();
            return process.exit(0);
        }
        if (["up", "down", "left", "right"].includes(k as any)) return;
        done();
    };

    if (stdin.isTTY) stdin.setRawMode(true);
    stdin.on("keypress", handleKeyPress);

    for (const message of messages) {
        const _message = Array.isArray(message) ? message : message.split(" ");
        const msg: string[] = [];

        for (const word of [""].concat(_message)) {
            if (word) msg.push(word);

            const styledMessage = msg.join(" ").replace(/sugarcube/g, color.cyan("sugarcube"));

            const sidebarFormattedMessage = `${sidebarSymbol}  ${styledMessage}`;
            logUpdate(sidebarFormattedMessage);

            if (!cancelled)
                await new Promise((r) =>
                    setTimeout(r, Math.floor(Math.random() * (200 - 75 + 1)) + 75)
                );
        }

        if (!cancelled) await new Promise((r) => setTimeout(r, 100));

        const finalMessage = await Promise.all(_message).then((res) => res.join(" "));
        const styledFinalMessage = finalMessage.replace(/sugarcube/g, color.cyan("sugarcube"));

        logUpdate(`${sidebarSymbol}  ${styledFinalMessage}`);
        if (!cancelled)
            await new Promise((r) =>
                setTimeout(r, Math.floor(Math.random() * (1400 - 1200 + 1)) + 1200)
            );
        i++;
    }

    stdin.off("keypress", handleKeyPress);
    await new Promise((r) => setTimeout(r, 100));
    done();
    if (stdin.isTTY) stdin.setRawMode(false);
    stdin.removeAllListeners("keypress");
};
