import { EventEmitter } from "node:events";
import { mkdtemp, realpath, rm, stat, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type DesignTokens } from "../../src/index.js";
import { type ReadEvent, type TokensOnDisk, createLiveTokens } from "../../src/node.js";
import { useTempFolder } from "./temp-folder.js";

const afterRead = vi.hoisted(() => ({ once: undefined as (() => Promise<void>) | undefined }));

vi.mock("../../src/node/read.js", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../../src/node/read.js")>();
    return {
        ...actual,
        read: async (...args: Parameters<typeof actual.read>) => {
            const opened = await actual.read(...args);
            const then = afterRead.once;
            afterRead.once = undefined;
            await then?.();
            return opened;
        },
    };
});

const color = (hex: string) => ({ $type: "color", $value: hex });

const folder = useTempFolder("dtcg-live-");
const outside: string[] = [];
let entryFile: string;

beforeEach(async () => {
    await tokens("base.json", { color: { ink: color("#111111") } });
    await tokens("more.json", { color: { paper: color("#eeeeee") } });
    await resolver(["base.json"]);
    entryFile = folder.at("tokens.resolver.json");
});

afterEach(async () => {
    for (const each of outside.splice(0)) {
        await rm(each, { recursive: true, force: true });
    }
});

function tokens(file: string, json: unknown) {
    return writeFile(folder.at(file), JSON.stringify(json));
}

function resolver(files: string[]) {
    return writeFile(
        folder.at("tokens.resolver.json"),
        JSON.stringify({
            version: "2025.10",
            resolutionOrder: [
                { type: "set", name: "base", sources: files.map((file) => ({ $ref: file })) },
            ],
        }),
    );
}

const disk = (file: string) => folder.at(file).replaceAll("\\", "/");

function standIn() {
    const added: string[] = [];
    const watcher = Object.assign(new EventEmitter(), {
        add(paths: string | readonly string[]) {
            added.push(...(typeof paths === "string" ? [paths] : paths));
        },
    });
    const save = (file: string) => watcher.emit("change", disk(file));
    return { watcher, added, save };
}

function live(
    source: TokensOnDisk | (() => TokensOnDisk) = { entryFile },
    whenReading?: (read: number) => void,
) {
    const errors: unknown[] = [];
    let started = 0;
    const asked = () => {
        whenReading?.(started++);
        return typeof source === "function" ? source() : source;
    };
    const current = createLiveTokens(asked, { onError: (error) => errors.push(error) });
    const reads: Array<{ tokens: DesignTokens; event: ReadEvent }> = [];
    current.onRead((read, event) => reads.push({ tokens: read, event }));
    const { watcher, added, save } = standIn();
    current.watch(watcher);
    return { current, errors, reads, watcher, added, save };
}

const hexOf = (opened: DesignTokens) =>
    JSON.stringify(opened.getPermutation().getToken("color.ink"));

describe("design tokens kept current with their files", () => {
    it("reads at once, and reads again when a file it lists is saved", async () => {
        const { current, reads, save } = live({ entryFile, options: { hexStringColors: true } });
        const first = await current.getTokens();
        expect(first.files).toStrictEqual(["tokens.resolver.json", "base.json"]);

        await tokens("base.json", { color: { ink: color("#222222") } });
        save("base.json");
        const next = await current.getTokens();

        expect(hexOf(next)).toContain("#222222");
        expect(reads.map(({ tokens: read }) => read)).toStrictEqual([next]);
    });

    it("keeps the text of each file it read with the design tokens", async () => {
        const { current } = live();
        const first = await current.getTokens();

        expect(Object.keys(first.toMemory().files)).toStrictEqual(first.files);
        expect(first.getText("base.json")).toBe(
            JSON.stringify({ color: { ink: color("#111111") } }),
        );
    });

    it("holds the text a save wrote, with the design tokens read from it", async () => {
        const { current, save } = live();
        await current.getTokens();

        await tokens("base.json", { color: { ink: color("#222222") } });
        save("base.json");
        const next = await current.getTokens();

        expect(hexOf(next)).toContain("#222222");
        expect(next.getText("base.json")).toBe(
            JSON.stringify({ color: { ink: color("#222222") } }),
        );
    });

    it("reads again when a file it lists is added or deleted", async () => {
        const { current, reads, watcher } = live();
        await current.getTokens();

        watcher.emit("unlink", disk("base.json"));
        await current.getTokens();
        watcher.emit("add", disk("base.json"));
        await current.getTokens();

        expect(reads.map(({ event }) => event.file)).toStrictEqual(["base.json", "base.json"]);
    });

    it("collapses saves during a read into exactly one more read, the one listeners hear", async () => {
        const { current, reads, save } = live({ entryFile }, (read) => {
            if (read !== 1) return;
            save("base.json");
            save("tokens.resolver.json");
            save("base.json");
        });
        await current.getTokens();

        save("base.json");
        await vi.waitFor(() => expect(reads).toHaveLength(1));
        await current.getTokens();

        expect(reads).toHaveLength(1);
        expect(reads.map(({ event }) => event.file)).toStrictEqual(["base.json"]);
    });

    it("tells listeners of a read only when no read waiting to start has replaced it", async () => {
        let hexStringColors = false;
        const { current, reads, save } = live(
            () => ({ entryFile, options: { hexStringColors } }),
            (read) => {
                if (read !== 1) return;
                hexStringColors = true;
                void current.reread();
            },
        );
        await current.getTokens();

        save("base.json");
        await vi.waitFor(() => expect(reads).toHaveLength(1));
        await current.getTokens();

        expect(reads).toHaveLength(1);
        expect(reads[0]?.tokens.diagnostics).toStrictEqual([]);
        expect(reads[0]?.event.file).toBeUndefined();
    });

    it("waits for a read waiting to start before answering with the design tokens", async () => {
        let answer: Promise<DesignTokens> | undefined;
        const { current, reads, save } = live({ entryFile }, (read) => {
            if (read !== 1) return;
            save("base.json");
            answer = current.getTokens();
        });
        await current.getTokens();

        save("base.json");
        await vi.waitFor(() => expect(answer).toBeDefined());

        expect(await answer).toBe(reads[0]?.tokens);
        expect(reads).toHaveLength(1);
    });

    it("reads again when a read caught a file half-saved and the watcher never says", async () => {
        const { current, reads, watcher } = live();
        await current.getTokens();

        const path = folder.at("base.json");
        await writeFile(path, "");
        const looked = await stat(path);
        afterRead.once = async () => {
            await tokens("base.json", { color: { ink: color("#222222") } });
            await utimes(path, looked.atime, looked.mtime);
        };
        watcher.emit("change", disk("base.json"), looked);

        await vi.waitFor(() =>
            expect(hexOf(reads.at(-1)?.tokens as DesignTokens)).toContain("222222"),
        );
        const last = await current.getTokens();
        expect(hexOf(last)).toContain("222222");
        expect(last.diagnostics.map(({ kind }) => kind)).not.toContain("invalid-json");
        expect(hexOf(reads.at(-1)?.tokens as DesignTokens)).toContain("222222");
    });

    it("reads a file that is broken, and left so, only once", async () => {
        const { current, reads, save } = live();
        await current.getTokens();

        await writeFile(folder.at("base.json"), "{");
        save("base.json");

        await vi.waitFor(() => expect(reads).toHaveLength(1));
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(reads).toHaveLength(1);
        expect(reads[0]?.tokens.diagnostics.map(({ kind }) => kind)).toContain("invalid-json");
    });

    it("reads again when a file a read gains was saved during that read", async () => {
        const { current, reads, save } = live({ entryFile }, (read) => {
            if (read === 1) save("more.json");
        });
        await current.getTokens();

        await resolver(["base.json", "more.json"]);
        save("tokens.resolver.json");

        await vi.waitFor(() => expect(reads).toHaveLength(1));
        await current.getTokens();
        expect(reads.map(({ event }) => event.file)).toStrictEqual(["more.json"]);
        expect(reads[0]?.tokens.files).toContain("more.json");
    });

    it("does not read again for a file the design tokens never listed", async () => {
        const { current, reads, save } = live();
        const first = await current.getTokens();

        save("more.json");
        save("notes.json");

        expect(await current.getTokens()).toBe(first);
        expect(reads).toHaveLength(0);
    });

    it("does not read again for a file the design tokens no longer list", async () => {
        await resolver(["base.json", "more.json"]);
        const { current, reads, save } = live();
        await current.getTokens();

        await resolver(["base.json"]);
        save("tokens.resolver.json");
        const latest = await current.getTokens();
        save("more.json");

        expect(await current.getTokens()).toBe(latest);
        expect(reads).toHaveLength(1);
    });

    it("names the saved file as the design tokens do, and times the read", async () => {
        const { current, reads, save } = live();
        await current.getTokens();

        save("base.json");
        await current.getTokens();
        await current.reread();

        expect(reads.map(({ event }) => Object.keys(event).sort())).toStrictEqual([
            ["file", "ms"],
            ["ms"],
        ]);
        expect(reads[0]?.event.file).toBe("base.json");
        expect(reads[0]?.event.ms).toBeGreaterThan(0);
        expect(reads[1]?.event.ms).toBeGreaterThan(0);
    });

    it("matches a path the watcher gives with backslashes", async () => {
        const { current, reads, watcher } = live();
        await current.getTokens();

        watcher.emit("change", disk("base.json").replaceAll("/", "\\"));
        await current.getTokens();

        expect(reads.map(({ event }) => event.file)).toStrictEqual(["base.json"]);
    });

    it("matches a path the watcher gives relative to the working directory", async () => {
        const { current, reads, watcher } = live();
        await current.getTokens();

        watcher.emit("change", relative(process.cwd(), folder.at("base.json")));
        await current.getTokens();

        expect(reads.map(({ event }) => event.file)).toStrictEqual(["base.json"]);
    });

    it("watches and matches a file named from the root", async () => {
        const elsewhere = await realpath(await mkdtemp(join(tmpdir(), "dtcg-live-outside-")));
        outside.push(elsewhere);
        const brand = join(elsewhere, "brand.json").replaceAll("\\", "/");
        await writeFile(brand, JSON.stringify({ brand: color("#333333") }));
        await resolver(["base.json", brand]);
        const { current, reads, watcher, added } = live();
        await current.getTokens();

        watcher.emit("change", brand);
        await current.getTokens();

        expect(added).toContain(brand);
        expect(reads.map(({ event }) => event.file)).toStrictEqual([brand]);
    });

    it("watches a file named relative to a folder above the entry's", async () => {
        const elsewhere = await realpath(await mkdtemp(join(tmpdir(), "dtcg-live-outside-")));
        outside.push(elsewhere);
        const brand = join(elsewhere, "brand.json");
        await writeFile(brand, JSON.stringify({ brand: color("#333333") }));
        const name = relative(folder.path, brand).replaceAll("\\", "/");
        await resolver(["base.json", name]);
        const { current, reads, watcher, added } = live();
        await current.getTokens();

        watcher.emit("change", brand.replaceAll("\\", "/"));
        await current.getTokens();

        expect(added).toContain(brand.replaceAll("\\", "/"));
        expect(reads.map(({ event }) => event.file)).toStrictEqual([name]);
    });

    it("adds the files it lists to the watcher at once, then each file a later read gains", async () => {
        const { current, added, save } = live();
        await current.getTokens();
        const now = [...added];

        await resolver(["base.json", "more.json"]);
        save("tokens.resolver.json");
        await current.getTokens();

        expect(now.sort()).toStrictEqual([disk("base.json"), disk("tokens.resolver.json")]);
        expect(added.slice(now.length)).toStrictEqual([disk("more.json")]);
    });

    it("adds its files to a watcher given before the first read ends", async () => {
        const current = createLiveTokens({ entryFile }, { onError: () => {} });
        const { watcher, added } = standIn();
        current.watch(watcher);
        await current.getTokens();

        expect(added.sort()).toStrictEqual([disk("base.json"), disk("tokens.resolver.json")]);
    });

    it("reads an entry given relative to the working directory", async () => {
        const { current, reads, save, added } = live({
            entryFile: relative(process.cwd(), entryFile),
        });
        await current.getTokens();

        save("base.json");
        await current.getTokens();

        expect(added).toContain(disk("base.json"));
        expect(reads).toHaveLength(1);
    });

    it("asks the source again when told to read again", async () => {
        let hexStringColors = false;
        let asked = 0;
        const { current, reads } = live(() => {
            asked += 1;
            return { entryFile, options: { hexStringColors } };
        });
        expect((await current.getTokens()).diagnostics.map(({ kind }) => kind)).toContain(
            "hex-string-color",
        );

        hexStringColors = true;
        await expect(current.reread()).resolves.toBeUndefined();
        const next = await current.getTokens();

        expect(asked).toBe(2);
        expect(next.diagnostics).toStrictEqual([]);
        expect(reads.map(({ tokens: read }) => read)).toStrictEqual([next]);
    });

    it("stops calling a listener once it unsubscribes", async () => {
        const { current, save } = live();
        await current.getTokens();
        const seen: DesignTokens[] = [];
        const stop = current.onRead((read) => seen.push(read));

        save("base.json");
        await current.getTokens();
        stop();
        save("base.json");
        await current.getTokens();

        expect(seen).toHaveLength(1);
    });

    it("gives what a listener throws to onError, and still calls the others", async () => {
        const { current, errors, reads, save } = live();
        await current.getTokens();
        const broke = new Error("the listener broke");
        current.onRead(() => {
            throw broke;
        });
        const seen: DesignTokens[] = [];
        current.onRead((read) => seen.push(read));

        save("base.json");
        await current.getTokens();

        expect(errors).toStrictEqual([broke]);
        expect(reads).toHaveLength(1);
        expect(seen).toHaveLength(1);
    });

    it("gives a read that rejects to onError, with no unhandled rejection", async () => {
        const unhandled: unknown[] = [];
        const onUnhandled = (reason: unknown) => unhandled.push(reason);
        process.on("unhandledRejection", onUnhandled);
        try {
            const failure = new Error("no source");
            let fail = false;
            const { current, errors, reads, save } = live(() => {
                if (fail) throw failure;
                return { entryFile };
            });
            await current.getTokens();

            fail = true;
            save("base.json");
            await expect(current.getTokens()).rejects.toBe(failure);
            await new Promise((settled) => setTimeout(settled, 10));

            expect(errors).toStrictEqual([failure]);
            expect(reads).toHaveLength(0);
            expect(unhandled).toStrictEqual([]);

            await expect(current.reread()).resolves.toBeUndefined();
            await new Promise((settled) => setTimeout(settled, 10));
            expect(errors).toStrictEqual([failure, failure]);
            expect(unhandled).toStrictEqual([]);

            fail = false;
            save("base.json");
            await current.getTokens();
            expect(reads).toHaveLength(1);
        } finally {
            process.off("unhandledRejection", onUnhandled);
        }
    });

    it("gives a first read that rejects to onError, with no unhandled rejection", async () => {
        const unhandled: unknown[] = [];
        const onUnhandled = (reason: unknown) => unhandled.push(reason);
        process.on("unhandledRejection", onUnhandled);
        try {
            const failure = new Error("no source");
            const errors: unknown[] = [];
            createLiveTokens(
                () => {
                    throw failure;
                },
                { onError: (error) => errors.push(error) },
            );
            await new Promise((settled) => setTimeout(settled, 10));

            expect(errors).toStrictEqual([failure]);
            expect(unhandled).toStrictEqual([]);
        } finally {
            process.off("unhandledRejection", onUnhandled);
        }
    });
});
