import { EventEmitter } from "node:events";
import { readFileSync, writeFileSync } from "node:fs";
import { mkdtemp, realpath, rm, stat, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { onFileChanged } from "../../src/node.js";

let folder: string;
let file: string;

beforeEach(async () => {
    folder = await realpath(await mkdtemp(join(tmpdir(), "dtcg-changed-")));
    file = join(folder, "base.json");
    await writeFile(file, '{ "a": 1 }');
});

afterEach(async () => {
    await rm(folder, { recursive: true, force: true });
});

const pastTheWindow = () => new Promise((resolve) => setTimeout(resolve, 120));

function heard() {
    const watcher = new EventEmitter();
    const paths: string[] = [];
    const stop = onFileChanged(watcher, (path) => paths.push(path));
    return { watcher, paths, stop };
}

describe("onFileChanged", () => {
    it("passes on each save the watcher reports, and nothing it adds or deletes", async () => {
        const { watcher, paths } = heard();

        watcher.emit("change", file, await stat(file));
        watcher.emit("add", join(folder, "new.json"));
        watcher.emit("unlink", join(folder, "old.json"));
        await pastTheWindow();

        expect(paths).toStrictEqual([file]);
    });

    it("reports a save once more when its last write came after the watcher looked", async () => {
        const { watcher, paths } = heard();

        await writeFile(file, "");
        watcher.emit("change", file, await stat(file));
        writeFileSync(file, '{ "a": 2 }');
        await pastTheWindow();

        expect(paths).toStrictEqual([file, file]);
    });

    it("tells the writes apart by size when the clock gave them the same time", async () => {
        const { watcher, paths } = heard();

        await writeFile(file, "");
        const looked = await stat(file);
        watcher.emit("change", file, looked);
        writeFileSync(file, '{ "a": 2 }');
        await utimes(file, looked.atime, looked.mtime);
        await pastTheWindow();

        expect(paths).toStrictEqual([file, file]);
    });

    it("reports a save once when nothing was written after the watcher looked", async () => {
        const { watcher, paths } = heard();

        watcher.emit("change", file, await stat(file));
        await pastTheWindow();

        expect(paths).toStrictEqual([file]);
    });

    it("looks at the file itself when the watcher gives no stats", async () => {
        const { watcher, paths } = heard();

        watcher.emit("change", file);
        await pastTheWindow();

        expect(paths).toStrictEqual([file]);
    });

    it("looks before the listener reads, when the watcher gives no stats", async () => {
        const watcher = new EventEmitter();
        const read: string[] = [];
        onFileChanged(watcher, (path) => {
            read.push(readFileSync(path, "utf8"));
            if (read.length === 1) writeFileSync(path, '{ "a": 2 }');
        });

        await writeFile(file, "");
        watcher.emit("change", file);
        await pastTheWindow();

        expect(read).toStrictEqual(["", '{ "a": 2 }']);
    });

    it("reports nothing more once stopped", async () => {
        const { watcher, paths, stop } = heard();

        await writeFile(file, "");
        watcher.emit("change", file, await stat(file));
        stop();
        writeFileSync(file, '{ "a": 2 }');
        await pastTheWindow();

        expect(paths).toStrictEqual([file]);
    });
});
