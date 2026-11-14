import { rename, setValue } from "@sugarcube-sh/dtcg-edit";
import { describe, expect, it, vi } from "vitest";
import { decodeEdits, encodeEdits } from "../../src/controllers/edits-text";
import { persistUnsavedEdits } from "../../src/controllers/unsaved";
import { demoMessage, createDemoStudio, withFile } from "./demo-message";

const darkOptions = { input: { mode: "dark" } } as const;

const expectStoredSteps = (storage: { items: Map<string, string> }, key: string, edits = 1) =>
    vi.waitFor(async () => {
        const storedText = storage.items.get(key);
        expect(storedText && (await decodeEdits(storedText))?.steps).toHaveLength(edits);
    });

function memoryStorage() {
    const items = new Map<string, string>();
    return {
        items,
        getItem: (key: string) => items.get(key) ?? null,
        setItem: (key: string, value: string) => void items.set(key, value),
        removeItem: (key: string) => void items.delete(key),
    };
}

describe("edits as text", () => {
    it("gives back the same edits", async () => {
        const studio = createDemoStudio();
        studio.do(rename(studio.state.tokens, "color.text.default", "body"));

        expect(await decodeEdits(await encodeEdits(studio.unsaved))).toEqual(studio.unsaved);
    });

    it("gives nothing for text that isn't edits", async () => {
        expect(await decodeEdits("not even close")).toBeUndefined();
        expect(await decodeEdits(await encodeText('{ "ops": "no" }'))).toBeUndefined();
    });
});

describe("persistUnsavedEdits", () => {
    it("puts unsaved edits back when studio opens again, as after a reload", async () => {
        const storage = memoryStorage();
        const before = createDemoStudio();
        persistUnsavedEdits(before, storage, "demo");
        before.do(
            setValue(before.state.tokens, "color.text.default", "{color.neutral.100}", darkOptions),
        );
        await expectStoredSteps(storage, "demo");

        const after = createDemoStudio();
        await persistUnsavedEdits(after, storage, "demo");

        expect(after.state.changes.map(({ path }) => path)).toEqual(["color.text.default"]);
        expect(after.state.clashes).toEqual([]);
    });

    it("keeps nothing once the edits are saved or discarded", async () => {
        const storage = memoryStorage();
        const studio = createDemoStudio();
        persistUnsavedEdits(studio, storage, "demo");
        studio.do(
            setValue(studio.state.tokens, "color.text.default", "{color.neutral.100}", darkOptions),
        );
        await expectStoredSteps(storage, "demo");

        studio.discard();

        await vi.waitFor(() => expect(storage.items.has("demo")).toBe(false));
    });

    it("gives a clash for an edit the files no longer fit, keeping the rest", async () => {
        const storage = memoryStorage();
        const before = createDemoStudio();
        persistUnsavedEdits(before, storage, "demo");
        before.do(
            setValue(before.state.tokens, "color.text.default", "{color.neutral.100}", darkOptions),
        );
        before.do(setValue(before.state.tokens, "radius.md", { value: 0.5, unit: "rem" }));
        await expectStoredSteps(storage, "demo", 2);

        const dark = demoMessage().files["dark.json"] ?? "";
        const after = createDemoStudio(
            withFile("dark.json", dark.replace("{color.neutral.50}", "{color.neutral.200}")),
        );
        await persistUnsavedEdits(after, storage, "demo");

        expect(after.state.changes.map(({ path }) => path)).toEqual(["radius.md"]);
        expect(
            after.state.clashes
                .flatMap((clash) => clash.parts)
                .map(({ path, yours, theirs }) => [path, yours, theirs]),
        ).toEqual([
            [
                "color.text.default",
                { $value: "{color.neutral.100}" },
                { $value: "{color.neutral.200}" },
            ],
        ]);
    });

    it("keeps each project's edits apart", async () => {
        const storage = memoryStorage();
        const studio = createDemoStudio();
        persistUnsavedEdits(studio, storage, "one");
        studio.do(setValue(studio.state.tokens, "radius.md", { value: 0.5, unit: "rem" }));
        await expectStoredSteps(storage, "one");

        const other = createDemoStudio();
        await persistUnsavedEdits(other, storage, "two");

        expect(other.state.changes).toEqual([]);
    });
});

async function encodeText(text: string): Promise<string> {
    const bytes = new TextEncoder().encode(text);
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"));
    const zipped = new Uint8Array(await new Response(stream).arrayBuffer());
    let binary = "";
    for (const byte of zipped) binary += String.fromCharCode(byte);
    return btoa(binary)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/={1,2}$/, "");
}
