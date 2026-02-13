import color from "picocolors";
import { sayAnimatedInSidebar } from "./animated-text.js";
import {
    type CommonOptions,
    S_BAR,
    S_ERROR,
    S_INFO,
    S_STEP_SUBMIT,
    S_SUCCESS,
    S_WARN,
} from "./common.js";
import { executeTasksInSidebar } from "./tasks.js";

interface LogMessageOptions extends CommonOptions {
    symbol?: string;
    spacing?: number;
    secondarySymbol?: string;
}

export const rawLog = (message: string) => process.stdout.write(`${message}\n`);

export const log = {
    message: (
        message: string | string[] = [],
        {
            symbol = color.gray(S_BAR),
            secondarySymbol = color.gray(S_BAR),
            output = process.stdout,
            spacing = 1,
        }: LogMessageOptions = {}
    ) => {
        const parts: string[] = [];
        for (let i = 0; i < spacing; i++) {
            parts.push(`${secondarySymbol}`);
        }
        const messageParts = Array.isArray(message) ? message : message.split("\n");
        if (messageParts.length > 0) {
            const [firstLine, ...lines] = messageParts;
            if (firstLine && firstLine.length > 0) {
                parts.push(`${symbol}  ${firstLine}`);
            } else {
                parts.push(symbol);
            }
            for (const ln of lines) {
                if (ln.length > 0) {
                    parts.push(`${secondarySymbol}  ${ln}`);
                } else {
                    parts.push(secondarySymbol);
                }
            }
        }
        output.write(`${parts.join("\n")}\n`);
    },
    info: (message: string, opts?: LogMessageOptions) => {
        log.message(message, { ...opts, symbol: color.blue(S_INFO) });
    },
    success: (message: string, opts?: LogMessageOptions) => {
        log.message(message, { ...opts, symbol: color.green(S_SUCCESS) });
    },
    step: (message: string, opts?: LogMessageOptions) => {
        log.message(message, { ...opts, symbol: color.green(S_STEP_SUBMIT) });
    },
    warn: (message: string, opts?: LogMessageOptions) => {
        log.message(message, { ...opts, symbol: color.yellow(S_WARN) });
    },
    error: (message: string, opts?: LogMessageOptions) => {
        log.message(message, { ...opts, symbol: color.red(S_ERROR) });
    },

    animated: async (
        messages: string[],
        {
            secondarySymbol = color.gray(S_BAR),
            output = process.stdout,
            clear = false,
            ...opts
        }: LogMessageOptions & { clear?: boolean } = {}
    ) => {
        return sayAnimatedInSidebar(messages, {
            sidebarSymbol: secondarySymbol,
            stdout: output as NodeJS.WriteStream,
            clear,
            ...opts,
        });
    },

    tasks: async (
        tasks: Array<{
            pending: string;
            start: string;
            end: string;
            while: () => Promise<void>;
            onError?: (error: Error) => void;
        }>,
        {
            spacing = 1,
            secondarySymbol = color.gray(S_BAR),
            output = process.stdout,
            ...opts
        }: LogMessageOptions & {
            spacing?: number;
            minDurationMs?: number;
            successPauseMs?: number;
            successMessage?: string;
            successAsOutro?: boolean;
        } = {}
    ) => {
        return executeTasksInSidebar(
            tasks as any,
            {
                sidebarSymbol: secondarySymbol,
                spacing,
                stdout: output as NodeJS.WriteStream,
                ...opts,
            } as any
        );
    },

    space: (lines = 1) => {
        for (let i = 0; i < lines; i++) {
            process.stdout.write(`${color.gray(S_BAR)}\n`);
        }
    },

    break: (lines = 1) => {
        for (let i = 0; i < lines; i++) {
            process.stdout.write("\n");
        }
    },
};
