import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createReadOptions } from "@sugarcube-sh/core/client";
import { read } from "@sugarcube-sh/dtcg/node";
import { createSession, setValue } from "@sugarcube-sh/dtcg-edit";
import { afterEach, describe, expect, it } from "vitest";
import { saveEdits } from "../../src/server/save";
import { demoCopy } from "./demo-copy";

const lighter = { colorSpace: "oklch", components: [0.9, 0.05, 258] };

let remove = () => {};
afterEach(() => remove());

async function demo() {
    const copy = demoCopy();
    remove = copy.remove;
    const onDisk = { entryFile: copy.config.resolver, options: createReadOptions(copy.config) };
    const session = createSession(await read(onDisk.entryFile, onDisk.options));
    session.do(setValue(session.tokens, "color.brand.500", lighter));
    return { ...copy, onDisk, edits: session.unsaved };
}

describe("saveEdits", () => {
    it("writes the files the edits change, and says which", async () => {
        const { dir, onDisk, edits } = await demo();
        const space = readFileSync(join(dir, "space.json"), "utf8");

        const saved = await saveEdits(onDisk, JSON.parse(JSON.stringify(edits)));

        expect(saved).toEqual({ written: ["color.json"], deleted: [] });
        expect(readFileSync(join(dir, "color.json"), "utf8")).toContain("0.9");
        expect(readFileSync(join(dir, "space.json"), "utf8")).toBe(space);
    });

    it("writes nothing, and gives the conflicts, when a file changed under the edits", async () => {
        const { dir, onDisk, edits } = await demo();
        const path = join(dir, "color.json");
        const theirs = readFileSync(path, "utf8").replace("0.624, 0.181", "0.5, 0.181");
        writeFileSync(path, theirs);

        const saved = await saveEdits(onDisk, edits);

        expect(saved.conflicts?.length).toBeGreaterThan(0);
        expect(readFileSync(path, "utf8")).toBe(theirs);
    });

    it("refuses what isn't edits, writing nothing", async () => {
        const { dir, onDisk } = await demo();
        const color = readFileSync(join(dir, "color.json"), "utf8");

        await expect(saveEdits(onDisk, { files: [] })).rejects.toThrow(/edits/);
        expect(readFileSync(join(dir, "color.json"), "utf8")).toBe(color);
    });
});
