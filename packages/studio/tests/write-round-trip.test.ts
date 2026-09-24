import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadTokens } from "@sugarcube-sh/core";
import {
    type ResolvedTokens,
    type TokenSources,
    isResolvedToken,
    resolveTokens,
} from "@sugarcube-sh/core/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { writeOpsToDisk } from "../src/server/write-ops-to-disk";
import { unwrapRef } from "../src/tokens/paths";
import {
    type SourceDocument,
    create,
    openDocument,
    remove,
    rename,
    setDescription,
    setValue,
} from "../src/tokens/source-document";
import { opsByFile } from "../src/tokens/write-ops";
import { fileNamed } from "./text-sources";

/**
 * The first half of the DTCG round trip (priorities item 16): what Studio
 * writes, core reads back unchanged. A copy of the demo on disk, one of each
 * edit, the operations replayed onto the files the way the server does, and
 * `loadTokens` again.
 */

const DEMO = join(__dirname, "../demo");

async function load(dir: string) {
    return loadTokens({
        type: "resolver",
        resolverPath: join(dir, "tokens.resolver.json"),
        config: { variables: {} } as never,
    });
}

const fileEnding = fileNamed;

/** A token nothing refers to, so removing it dangles nothing. */
function unreferenced(doc: SourceDocument): string {
    const referenced = new Set<string>();
    for (const node of Object.values(doc.resolved)) {
        if (!isResolvedToken(node)) continue;
        const ref = unwrapRef(node.$value);
        if (ref) referenced.add(ref);
    }
    for (const [handle] of doc.index.entries()) {
        const path = doc.index.pathOf(handle) as string;
        if (!referenced.has(path) && !path.startsWith("color.")) return path;
    }
    throw new Error("every token is referenced");
}

let dir: string;
let before: TokenSources;
let held: SourceDocument;
let readBack: ResolvedTokens;
let touched: Set<string>;

beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "sugarcube-round-trip-"));
    cpSync(DEMO, dir, { recursive: true });

    const loaded = await load(dir);
    before = loaded.sources as TokenSources;
    const context = (before.order[0] as { context: string }).context;
    const color = fileEnding(before, "color.json");

    const step = (next: SourceDocument | null, what: string) => {
        if (!next) throw new Error(`${what} returned null`);
        return next;
    };

    let doc = openDocument(before);
    doc = step(setValue(doc, "color.brand.500", "#ff0000", context), "setValue");
    doc = step(setDescription(doc, "color.brand.500", "Brand red", context), "setDescription");
    doc = step(
        create(doc, {
            parent: "color.brand",
            name: "950",
            sourcePath: color,
            token: { $type: "color", $value: "#100000" },
        }),
        "create token",
    );
    doc = step(create(doc, { parent: "color", name: "extra", sourcePath: color }), "create group");
    doc = step(rename(doc, "color.brand", "primary"), "rename");
    doc = step(remove(doc, unreferenced(doc)), "remove");
    held = doc;

    touched = new Set(doc.ops.map((op) => op.file));
    await writeOpsToDisk(
        {
            read: async (path) => readFileSync(path, "utf8"),
            write: async (path, text) => writeFileSync(path, text),
        },
        opsByFile(doc.ops),
    );

    readBack = resolveTokens((await load(dir)).trees).resolved;
});

afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
});

describe("what Studio writes, core reads back", () => {
    it("touched more than one file, through every kind of edit", () => {
        expect(touched.size).toBeGreaterThan(1);
        expect(new Set(held.ops.map((op) => op.kind))).toEqual(
            new Set(["set", "remove", "renameKey"]),
        );
    });

    it("as the same document: every key, none missing, none extra", () => {
        expect(Object.keys(readBack).sort()).toEqual(Object.keys(held.resolved).sort());
    });

    it("with the same value, type, description and extensions on every node", () => {
        const fields = ["$value", "$type", "$description", "$extensions"] as const;
        const differences: string[] = [];
        for (const key of Object.keys(held.resolved)) {
            for (const field of fields) {
                const ours = (held.resolved[key] as Record<string, unknown>)?.[field];
                const theirs = (readBack[key] as Record<string, unknown>)?.[field];
                if (JSON.stringify(ours) !== JSON.stringify(theirs)) {
                    differences.push(`${key} ${field}`);
                }
            }
        }
        expect(differences).toEqual([]);
    });

    it("leaves every file no operation touched byte for byte as it was", () => {
        for (const [file, text] of Object.entries(before.files)) {
            if (touched.has(file)) continue;
            expect(readFileSync(file, "utf8")).toBe(text);
        }
    });

    it("leaves every file it did touch as the text Studio holds", () => {
        for (const file of touched) {
            expect(readFileSync(file, "utf8")).toBe(held.sources.files[file]);
        }
    });
});
