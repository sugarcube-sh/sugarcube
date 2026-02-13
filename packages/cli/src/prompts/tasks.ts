// Heavily inspired by https://github.com/withastro/cli-kit/blob/main/src/spinner/index.ts

import * as readline from "node:readline";
import { createLogUpdate } from "log-update";
import color from "picocolors";
import { S_BAR_END, S_BAR_H, sleep } from "./common.js";

export interface Task {
    pending: string;
    start: string;
    end: string;
    while: () => Promise<void>;
    onError?: (error: Error) => void;
}

interface TaskLabels {
    start: string;
    end: string;
}

function getRandomTaskDuration(): number {
    return Math.floor(Math.random() * (750 - 200 + 1)) + 200; // Random between 200-750ms
}

function formatTask(task: Task, state: "start" | "end" | "pending" | "success") {
    switch (state) {
        case "start":
            return `${color.cyan(`▶ ${task.start}`)}`;
        case "pending":
            return `${color.dim(`□ ${task.pending}`)}`;
        case "success":
            return `${color.green(`✔ ${task.end}`)}`;
        case "end":
            return `${color.dim(`■ ${task.end}`)}`;
    }
}

async function executeTasks(
    tasks: Task[],
    {
        stdin = process.stdin,
        stdout = process.stdout,
        initialDelayMs = 200,
        minDurationMs,
        successPauseMs = 200,
        successMessage,
    }: {
        stdin?: NodeJS.ReadStream;
        stdout?: NodeJS.WriteStream;
        initialDelayMs?: number;
        minDurationMs?: number;
        successPauseMs?: number;
        successMessage?: string;
    } = {}
): Promise<void> {
    const text: string[] = Array.from({ length: tasks.length }, () => "");
    tasks.forEach((task, i) => {
        text[i] = formatTask(task, "pending");
    });

    const logUpdate = createLogUpdate(stdout);
    const rl = readline.createInterface({ input: stdin, escapeCodeTimeout: 50 });
    readline.emitKeypressEvents(stdin, rl);

    const keypress = (char: string) => {
        if (char === "\x03") {
            // Ctrl+C
            logUpdate.clear();
            rl.close();
            if (stdin.isTTY) stdin.setRawMode(false);
            process.exit(0);
        }
        if (stdin.isTTY) stdin.setRawMode(true);
    };

    if (stdin.isTTY) stdin.setRawMode(true);
    stdin.on("keypress", keypress);

    logUpdate(text.join("\n"));

    await sleep(initialDelayMs);

    let i = 0;

    for (const task of tasks) {
        text[i] = formatTask(task, "start");
        logUpdate(text.join("\n"));

        const startTime = Date.now();
        const taskPromise = task.while();

        try {
            await taskPromise;

            const elapsed = Date.now() - startTime;
            const minDuration =
                typeof minDurationMs === "number" ? minDurationMs : getRandomTaskDuration();
            if (elapsed < minDuration) {
                await sleep(minDuration - elapsed);
            }

            text[i] = formatTask(task, "success");
            logUpdate(text.join("\n"));

            await sleep(successPauseMs);
        } catch (e) {
            text[i] = `${color.red(`✗ ${task.end} (failed)`)}`;
            logUpdate(text.join("\n"));
            task.onError?.(e as Error);

            stdin.removeListener("keypress", keypress);
            rl.close();
            if (stdin.isTTY) stdin.setRawMode(false);
            throw e;
        }

        i++;
    }

    const successText = tasks.map((task) => formatTask(task, "end"));
    const footer = color.green(successMessage ?? "🎉 Project initialized successfully!");

    logUpdate(`${successText.join("\n")}\n\n${footer}`);

    await sleep(1000);

    stdin.removeListener("keypress", keypress);
    if (stdin.isTTY) stdin.setRawMode(false);
    rl.close();
    logUpdate.done();
}

export async function executeTasksInSidebar(
    tasks: Task[],
    {
        sidebarSymbol = "│",
        spacing = 1,
        stdin = process.stdin,
        stdout = process.stdout,
        initialDelayMs = 200,
        minDurationMs,
        successPauseMs = 300,
        successMessage,
        successAsOutro = false,
    }: {
        sidebarSymbol?: string;
        spacing?: number;
        stdin?: NodeJS.ReadStream;
        stdout?: NodeJS.WriteStream;
        initialDelayMs?: number;
        minDurationMs?: number;
        successPauseMs?: number;
        successMessage?: string;
        successAsOutro?: boolean;
    } = {}
): Promise<void> {
    const formatWithSidebar = (
        task: Task,
        state: "start" | "end" | "pending" | "success"
    ): string => {
        let taskText = "";
        switch (state) {
            case "start":
                taskText = `${color.cyan(`▶ ${task.start}`)}`;
                break;
            case "pending":
                taskText = `${color.dim(`□ ${task.pending}`)}`;
                break;
            case "success":
                taskText = `${color.green(`✔ ${task.end}`)}`;
                break;
            case "end":
                taskText = `${color.dim(`■ ${task.end}`)}`;
                break;
        }
        return `${sidebarSymbol}  ${taskText}`;
    };

    const text: string[] = Array.from({ length: tasks.length }, () => "");
    tasks.forEach((task, i) => {
        text[i] = formatWithSidebar(task, "pending");
    });

    const logUpdate = createLogUpdate(stdout);
    const rl = readline.createInterface({ input: stdin, escapeCodeTimeout: 50 });
    readline.emitKeypressEvents(stdin, rl);

    const keypress = (char: string) => {
        if (char === "\x03") {
            logUpdate.clear();
            rl.close();
            if (stdin.isTTY) stdin.setRawMode(false);
            process.exit(0);
        }
        if (stdin.isTTY) stdin.setRawMode(true);
    };

    if (stdin.isTTY) stdin.setRawMode(true);
    stdin.on("keypress", keypress);

    const spacingLines = Array.from({ length: Math.max(spacing, 0) }, () => `${sidebarSymbol}`);
    const renderContent = () => [...spacingLines, ...text].join("\n");

    logUpdate(renderContent());

    await sleep(initialDelayMs);

    let i = 0;

    for (const task of tasks) {
        text[i] = formatWithSidebar(task, "start");
        logUpdate(renderContent());

        const startTime = Date.now();
        const taskPromise = task.while();

        try {
            await taskPromise;

            const elapsed = Date.now() - startTime;
            const minDuration =
                typeof minDurationMs === "number" ? minDurationMs : getRandomTaskDuration();
            if (elapsed < minDuration) {
                await sleep(minDuration - elapsed);
            }

            text[i] = formatWithSidebar(task, "success");
            logUpdate(renderContent());

            await sleep(successPauseMs);
        } catch (e) {
            text[i] = `${sidebarSymbol}  ${color.red(`✗ ${task.end} (failed)`)}`;
            logUpdate(renderContent());
            task.onError?.(e as Error);

            stdin.removeListener("keypress", keypress);
            rl.close();
            if (stdin.isTTY) stdin.setRawMode(false);
            throw e;
        }

        i++;
    }

    const successText = tasks.map((task) => formatWithSidebar(task, "end"));

    if (successMessage) {
        if (!successAsOutro) {
            const footer = `${sidebarSymbol}  ${color.green(successMessage)}`;
            logUpdate([...spacingLines, ...successText, `${sidebarSymbol}`, footer].join("\n"));
        } else {
            // Success message with sidebar formatting (like outro)
            const footer = `${color.gray(S_BAR_END)}${color.gray(S_BAR_H)} ${color.green(successMessage)}`;
            logUpdate([...spacingLines, ...successText, `${sidebarSymbol}`, footer].join("\n"));
        }
    } else {
        // No success message - just show completed tasks
        logUpdate([...spacingLines, ...successText].join("\n"));
    }

    await sleep(1000);

    stdin.removeListener("keypress", keypress);
    if (stdin.isTTY) stdin.setRawMode(false);
    rl.close();
    logUpdate.done();
}
