import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { liveDocument } from "@sugarcube-sh/dtcg/node";
import { afterEach, describe, expect, it } from "vitest";
import {
    type Change,
    type Watched,
    type WatcherHandle,
    startWatcher,
} from "../src/watch/watcher.js";

const folders: string[] = [];
const handles: WatcherHandle[] = [];

afterEach(async () => {
    for (const handle of handles.splice(0)) await handle.close();
    for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});

function project() {
    const folder = mkdtempSync(join(tmpdir(), "sugarcube-watcher-"));
    folders.push(folder);
    for (const name of ["tokens", "a", "b"]) mkdirSync(join(folder, name));
    const tokens = (hex: string) =>
        writeFileSync(
            join(folder, "tokens/base.json"),
            JSON.stringify({ color: { ink: { $type: "color", $value: hex } } }),
        );
    tokens("#111111");
    const resolver = join(folder, "tokens/tokens.resolver.json");
    writeFileSync(
        resolver,
        JSON.stringify({
            version: "2025.10",
            resolutionOrder: [{ type: "set", name: "base", sources: [{ $ref: "base.json" }] }],
        }),
    );
    const configFile = join(folder, "sugarcube.config.ts");
    writeFileSync(configFile, "export default {};");
    return { folder, resolver, configFile, tokens };
}

async function until(done: () => boolean, what: string) {
    const started = Date.now();
    while (!done()) {
        if (Date.now() - started > 10_000) throw new Error(`Waited for ${what}`);
        await new Promise((resolve) => setTimeout(resolve, 20));
    }
}

describe("startWatcher", () => {
    it("puts each read of a token save into the queue, with the Document read", async () => {
        const { resolver, configFile, tokens } = project();
        const live = liveDocument({ entry: resolver }, { onError: () => {} });
        await live.document();
        const changes: Change[] = [];
        const watched: Watched = { markup: false };
        handles.push(
            await startWatcher(live, configFile, watched, {
                onChange: async (change) => {
                    changes.push(change);
                    return watched;
                },
                onError: () => {},
                onWarning: () => {},
            }),
        );

        let saves = 0;
        await until(() => {
            tokens(`#22222${saves++ % 10}`);
            return changes.length > 0;
        }, "the token change");
        const [change] = changes;
        expect(change?.kind).toBe("token");
        if (change?.kind !== "token") return;
        expect(change.read.file).toBe("base.json");
        expect(change.doc.files).toContain("base.json");
    });

    it("watches markup where the config a change loaded says", async () => {
        const { folder, resolver, configFile } = project();
        const live = liveDocument({ entry: resolver }, { onError: () => {} });
        await live.document();
        const changes: Change[] = [];
        const before: Watched = { content: [join(folder, "a/**/*.html")], markup: true };
        const after: Watched = { content: [join(folder, "b/**/*.html")], markup: true };
        handles.push(
            await startWatcher(live, configFile, before, {
                onChange: async (change) => {
                    changes.push(change);
                    return change.kind === "config" ? after : before;
                },
                onError: () => {},
                onWarning: () => {},
            }),
        );

        writeFileSync(configFile, "export default { content: ['b/**/*.html'] };");
        await until(() => changes.some(({ kind }) => kind === "config"), "the config change");

        const page = join(folder, "b/page.html");
        let saves = 0;
        await until(() => {
            writeFileSync(page, `<p class="text-ink">${saves++}</p>`);
            return changes.some((change) => change.kind === "markup" && change.path === page);
        }, "the markup change in the new folder");
    });

    it("reports a markup save whose last write landed while the watcher was dropping changes", async () => {
        const { folder, resolver, configFile } = project();
        const page = join(folder, "a/page.html");
        writeFileSync(page, "<p>0</p>");
        const live = liveDocument({ entry: resolver }, { onError: () => {} });
        await live.document();
        const saves: string[] = [];
        const watched: Watched = { content: [join(folder, "a/**/*.html")], markup: true };
        handles.push(
            await startWatcher(live, configFile, watched, {
                onChange: async (change) => {
                    if (change.kind !== "markup") return watched;
                    saves.push(change.path);
                    if (saves.length === 1) writeFileSync(page, '<p class="text-ink">finished</p>');
                    return watched;
                },
                onError: () => {},
                onWarning: () => {},
            }),
        );

        await until(() => {
            if (saves.length === 0) writeFileSync(page, "");
            return saves.length >= 2;
        }, "the save's last write");
        expect(new Set(saves)).toStrictEqual(new Set([page]));
    });

    it("reports a config save whose last write landed while the watcher was dropping changes", async () => {
        const { resolver, configFile } = project();
        const live = liveDocument({ entry: resolver }, { onError: () => {} });
        await live.document();
        const saves: string[] = [];
        const watched: Watched = { markup: false };
        handles.push(
            await startWatcher(live, configFile, watched, {
                onChange: async (change) => {
                    if (change.kind !== "config") return watched;
                    saves.push(change.path);
                    if (saves.length === 1) {
                        writeFileSync(
                            configFile,
                            'export default { variables: { prefix: "ds" } };',
                        );
                    }
                    return watched;
                },
                onError: () => {},
                onWarning: () => {},
            }),
        );

        await until(() => {
            if (saves.length === 0) writeFileSync(configFile, "");
            return saves.length >= 2;
        }, "the save's last write");
        expect(new Set(saves)).toStrictEqual(new Set([configFile]));
    });
});
