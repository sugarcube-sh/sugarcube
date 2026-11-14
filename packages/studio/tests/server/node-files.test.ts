import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { FileWatcher } from "@sugarcube-sh/dtcg/node";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createNodeFiles } from "../../src/server/node-files";
import { copyDemo } from "./copy-demo";

let remove = () => {};
afterEach(() => remove());

function watcher() {
    const added: string[] = [];
    const listeners: Record<string, ((path: string) => void)[]> = {};
    const given: FileWatcher = {
        add: (paths) => added.push(...(typeof paths === "string" ? [paths] : paths)),
        on: (event, listener) => (listeners[event] ??= []).push(listener),
    };
    return { given, added, change: (path: string) => listeners.change?.forEach((fn) => fn(path)) };
}

async function demo() {
    const copy = copyDemo();
    remove = copy.remove;
    const files = await createNodeFiles(copy.config, {
        onError: (error) => {
            throw error;
        },
    });
    return { ...copy, files };
}

describe("createNodeFiles", () => {
    it("sends every file the tokens are read from", async () => {
        const { dir, files } = await demo();

        const sent = files.getSnapshot().tokens.toMemory().files;

        expect(sent["dark.json"]).toBe(readFileSync(join(dir, "dark.json"), "utf8"));
        expect(sent["tokens.resolver.json"]).toBeDefined();
    });

    it("watches every file the tokens are read from", async () => {
        const { dir, files } = await demo();
        const { given, added } = watcher();

        files.watch(given);

        expect(added).toContain(join(dir, "dark.json"));
        expect(added).toContain(join(dir, "color.json"));
    });

    it("sends the files again when one changes on disk", async () => {
        const { dir, files } = await demo();
        const { given, change } = watcher();
        files.watch(given);
        const changed = new Promise<void>((resolve) => files.onChange(resolve));
        const path = join(dir, "dark.json");
        const edited = readFileSync(path, "utf8").replace(
            "{color.neutral.50}",
            "{color.neutral.100}",
        );

        writeFileSync(path, edited);
        change(path);
        await changed;

        expect(files.getSnapshot().tokens.getText("dark.json")).toBe(edited);
    });

    it("stops telling a listener once it stops listening", async () => {
        const { dir, files } = await demo();
        const { given, change } = watcher();
        files.watch(given);
        const listener = vi.fn();
        const stop = files.onChange(listener);
        const told = new Promise<void>((resolve) => files.onChange(resolve));

        stop();
        writeFileSync(
            join(dir, "dark.json"),
            readFileSync(join(dir, "dark.json"), "utf8").replace("50}", "100}"),
        );
        change(join(dir, "dark.json"));
        await told;

        expect(listener).not.toHaveBeenCalled();
    });
});
