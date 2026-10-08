import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { type Document, token } from "@sugarcube-sh/dtcg";
import { type ViteDevServer, createServer } from "vite";
import { afterEach, describe, expect, it } from "vitest";
import dtcg, { type DtcgApi, type DtcgOptions } from "../src/index.js";

const color = (hex: string) => ({ $type: "color", $value: hex });

let folder: string;
let server: ViteDevServer | undefined;

afterEach(async () => {
    await server?.close();
    server = undefined;
    await rm(folder, { recursive: true, force: true });
});

async function project(): Promise<string> {
    folder = await mkdtemp(join(tmpdir(), "dtcg-vite-"));
    await mkdir(join(folder, "tokens"));
    await tokens("base.json", { color: { ink: color("#111111") } });
    await resolver(["base.json"]);
    return join(folder, "tokens/tokens.resolver.json");
}

function tokens(file: string, json: unknown) {
    return writeFile(join(folder, "tokens", file), JSON.stringify(json));
}

function resolver(files: string[]) {
    const sources = files.map((file) => ({ $ref: file }));
    return writeFile(
        join(folder, "tokens/tokens.resolver.json"),
        JSON.stringify({
            version: "2025.10",
            resolutionOrder: [{ type: "set", name: "base", sources }],
        }),
    );
}

async function serve(options: DtcgOptions | (() => DtcgOptions)): Promise<DtcgApi> {
    const plugin = dtcg(options);
    server = await createServer({
        root: folder,
        configFile: false,
        logLevel: "silent",
        plugins: [plugin],
        server: { port: 0 },
    });
    await plugin.api.document();
    return plugin.api;
}

function nextRead(api: DtcgApi): Promise<Document> {
    return new Promise((resolve) => {
        const stop = api.onRead((doc) => {
            stop();
            resolve(doc);
        });
    });
}

const hexOf = (doc: Document, path: string) => JSON.stringify(token(doc, path));

describe("dtcg's Vite plugin", () => {
    it("reads the design system it is given", async () => {
        const entry = await project();
        const api = await serve({ entry, read: { hexStringColors: true } });

        const doc = await api.document();

        expect(doc.files).toEqual(["tokens.resolver.json", "base.json"]);
        expect(hexOf(doc, "color.ink")).toContain("#111111");
    });

    it("reads again when a file the Document lists is saved", async () => {
        const entry = await project();
        const api = await serve({ entry, read: { hexStringColors: true } });

        const read = nextRead(api);
        await tokens("base.json", { color: { ink: color("#222222") } });

        expect(hexOf(await read, "color.ink")).toContain("#222222");
        expect(hexOf(await api.document(), "color.ink")).toContain("#222222");
    });

    it("watches a file the resolver gains, and a file outside the project", async () => {
        const entry = await project();
        const outside = await mkdtemp(join(tmpdir(), "dtcg-vite-outside-"));
        try {
            await writeFile(
                join(outside, "brand.json"),
                JSON.stringify({ brand: color("#333333") }),
            );
            const api = await serve({ entry, read: { hexStringColors: true } });

            const gained = nextRead(api);
            await resolver([
                "base.json",
                relative(join(folder, "tokens"), join(outside, "brand.json")),
            ]);
            expect(hexOf(await gained, "brand")).toContain("#333333");

            const saved = nextRead(api);
            await writeFile(
                join(outside, "brand.json"),
                JSON.stringify({ brand: color("#444444") }),
            );
            expect(hexOf(await saved, "brand")).toContain("#444444");
        } finally {
            await rm(outside, { recursive: true, force: true });
        }
    });

    it("does not read again for a JSON file the Document does not list", async () => {
        const entry = await project();
        const api = await serve({ entry, read: { hexStringColors: true } });
        let reads = 0;
        api.onRead(() => {
            reads += 1;
        });

        await tokens("notes.json", { note: "not a token file" });
        const read = nextRead(api);
        await tokens("base.json", { color: { ink: color("#555555") } });
        await read;

        expect(reads).toBe(1);
    });

    it("tells each listener which file was saved and how long the read took", async () => {
        const entry = await project();
        const api = await serve({ entry, read: { hexStringColors: true } });
        const reads: Array<{ file?: string; ms: number }> = [];
        api.onRead((_, read) => reads.push(read));

        const saved = nextRead(api);
        await tokens("base.json", { color: { ink: color("#666666") } });
        await saved;
        await api.reread();

        expect(reads[0]?.file).toBe(join(folder, "tokens/base.json"));
        expect(reads[0]?.ms).toBeGreaterThan(0);
        expect(reads[1]?.file).toBeUndefined();
    });

    it("asks for its options again when told to read again", async () => {
        const entry = await project();
        let hexStringColors = false;
        const api = await serve(() => ({ entry, read: { hexStringColors } }));
        expect((await api.document()).diagnostics.map(({ kind }) => kind)).toContain(
            "hex-string-color",
        );

        hexStringColors = true;
        const doc = await api.reread();

        expect(doc.diagnostics).toEqual([]);
        expect(await api.document()).toBe(doc);
    });
});
