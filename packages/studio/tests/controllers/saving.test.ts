import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createReadOptions } from "@sugarcube-sh/core/client";
import type { Change } from "@sugarcube-sh/dtcg";
import { type Edits, setValue } from "@sugarcube-sh/dtcg-edit";
import { afterEach, describe, expect, it } from "vitest";
import { createAdapter } from "../../src/adapters";
import { createStudio } from "../../src/controllers/studio";
import { UserFacingError } from "../../src/error-messages";
import type { SaveResult } from "../../src/protocol";
import { saveEdits } from "../../src/server/save";
import { copyDemo } from "../server/copy-demo";
import { demoMessage, createDemoStudio } from "./demo-message";

const darkOptions = { input: { mode: "dark" } } as const;

function createSavingStudio(answer: (edits: Edits) => Promise<SaveResult>) {
    const sent: Edits[] = [];
    const sentChanges: (readonly Change[])[] = [];
    const studio = createStudio(demoMessage(), createAdapter, (edits, changes) => {
        sent.push(edits);
        sentChanges.push(changes);
        return answer(edits);
    });
    return { studio, sent, sentChanges };
}

const darkFile = () => demoMessage().files["dark.json"] ?? "";

const withFileText = (file: string, text: string) => ({ ...demoMessage().files, [file]: text });

let remove = () => {};
afterEach(() => remove());

describe("saving", () => {
    it("sends the unsaved edits, and has none left once the host has written them", async () => {
        const { studio, sent } = createSavingStudio(async () => ({
            savedFiles: ["dark.json"],
            deleted: [],
        }));
        studio.do(
            setValue(studio.state.tokens, "color.text.default", "{color.neutral.100}", darkOptions),
        );
        const edits = sent.length;

        const saved = await studio.save?.();

        expect(edits).toBe(0);
        expect(sent).toHaveLength(1);
        expect(sent[0]?.steps).toHaveLength(1);
        expect(saved).toEqual({ savedFiles: ["dark.json"], deleted: [] });
        expect(studio.state.changes).toEqual([]);
    });

    it("keeps every edit when the host refuses the save, and gives its conflicts", async () => {
        const conflict = {
            op: { kind: "delete-file", file: "x.json", was: "" },
            kind: "gone",
            reason: "x.json is gone",
        } as const;
        const { studio } = createSavingStudio(async () => ({ conflicts: [conflict] }));
        studio.do(
            setValue(studio.state.tokens, "color.text.default", "{color.neutral.100}", darkOptions),
        );

        const saved = await studio.save?.();

        expect(saved?.conflicts?.map(({ reason }) => reason)).toEqual(["x.json is gone"]);
        expect(studio.state.changes).toHaveLength(1);
    });

    it("tells the host what changed, for wording the save", async () => {
        const { studio, sentChanges } = createSavingStudio(async () => ({
            savedFiles: ["dark.json"],
            deleted: [],
        }));
        studio.do(
            setValue(studio.state.tokens, "color.text.default", "{color.neutral.100}", darkOptions),
        );
        const changes = studio.state.changes;

        await studio.save?.();

        expect(sentChanges).toEqual([changes]);
    });

    it("shows the files as they are now after a pull request opens, with nothing unsaved", async () => {
        const theirs = darkFile().replace("{color.neutral.50}", "{color.neutral.200}");
        const { studio } = createSavingStudio(async () => ({
            pullRequest: { number: 7, url: "https://github.com/pr/7" },
            files: withFileText("dark.json", theirs),
        }));
        studio.do(
            setValue(studio.state.tokens, "color.text.muted", "{color.neutral.300}", darkOptions),
        );

        await studio.save?.();

        expect(studio.state.tokens.getText("dark.json")).toBe(theirs);
        expect(studio.state.changes).toEqual([]);
        expect(studio.unsaved.steps).toEqual([]);
        expect(studio.state.clashes).toEqual([]);
    });

    it("turns a refused save's files into clashes, the files showing theirs", async () => {
        const theirs = darkFile().replace("{color.neutral.50}", "{color.neutral.200}");
        const conflict = {
            op: { kind: "delete-file", file: "x.json", was: "" },
            kind: "changed",
            reason: "changed",
        } as const;
        const { studio } = createSavingStudio(async () => ({
            conflicts: [conflict],
            files: withFileText("dark.json", theirs),
        }));
        studio.do(
            setValue(studio.state.tokens, "color.text.default", "{color.neutral.100}", darkOptions),
        );

        await studio.save?.();

        expect(studio.state.clashes).toHaveLength(1);
        expect(studio.state.clashes[0]?.parts.map((part) => [part.yours, part.theirs])).toEqual([
            [{ $value: "{color.neutral.100}" }, { $value: "{color.neutral.200}" }],
        ]);
        expect(studio.state.tokens.getText("dark.json")).toBe(theirs);
    });

    it("keeps an edit made while the save was on its way as unsaved", async () => {
        let answer: (saved: SaveResult) => void = () => {};
        const { studio } = createSavingStudio(() => new Promise((resolve) => (answer = resolve)));
        studio.do(
            setValue(studio.state.tokens, "color.text.default", "{color.neutral.100}", darkOptions),
        );

        const saving = studio.save?.();
        studio.do(
            setValue(studio.state.tokens, "color.text.muted", "{color.neutral.300}", darkOptions),
        );
        answer({ savedFiles: ["dark.json"], deleted: [] });
        await saving;

        expect(studio.state.changes.map(({ path }) => path)).toContain("color.text.muted");
    });

    it("keeps only an edit made while a pull request was opening as unsaved, not the one it sent", async () => {
        let answer: (saved: SaveResult) => void = () => {};
        const { studio } = createSavingStudio(() => new Promise((resolve) => (answer = resolve)));
        studio.do(
            setValue(studio.state.tokens, "color.text.default", "{color.neutral.100}", darkOptions),
        );

        const saving = studio.save?.();
        studio.do(
            setValue(studio.state.tokens, "color.text.muted", "{color.neutral.300}", darkOptions),
        );
        answer({
            pullRequest: { number: 7, url: "https://github.com/pr/7" },
            files: demoMessage().files,
        });
        await saving;

        expect(studio.state.changes.map(({ path }) => path)).toEqual(["color.text.muted"]);
    });

    it("offers no save when the host gives none, as a static build", () => {
        expect(createDemoStudio().save).toBeUndefined();
    });

    it("writes the edits into the files on disk through the host's save", async () => {
        const copy = copyDemo();
        remove = copy.remove;
        const onDisk = { entryFile: copy.config.resolver, options: createReadOptions(copy.config) };
        const studio = createStudio(demoMessage(), createAdapter, (edits) =>
            saveEdits(onDisk, JSON.parse(JSON.stringify(edits))),
        );
        studio.do(
            setValue(studio.state.tokens, "color.text.default", "{color.neutral.100}", darkOptions),
        );

        expect(await studio.save?.()).toEqual({ savedFiles: ["dark.json"], deleted: [] });
        expect(readFileSync(join(copy.dir, "dark.json"), "utf8")).toContain("{color.neutral.100}");
        expect(studio.state.changes).toEqual([]);
    });

    it("keeps the save's result in its state, shown until the edits change", async () => {
        const pullRequest = { number: 7, url: "https://github.com/pr/7" };
        const { studio } = createSavingStudio(async () => ({
            pullRequest,
            files: demoMessage().files,
        }));
        studio.do(
            setValue(studio.state.tokens, "color.text.default", "{color.neutral.100}", darkOptions),
        );
        await studio.save?.();
        expect(studio.state.saved).toStrictEqual({ pullRequest, files: demoMessage().files });
        studio.do(
            setValue(studio.state.tokens, "color.text.muted", "{color.neutral.300}", darkOptions),
        );
        expect(studio.state.saved).toBeUndefined();
    });

    it("keeps a clash's result while the clash is shown", async () => {
        const { studio } = createSavingStudio(
            async (edits) =>
                ({
                    conflicts: [{ kind: "changed", reason: "changed", op: edits.steps[0]?.ops[0] }],
                    files: demoMessage().files,
                    changedHost: "GitHub",
                }) as SaveResult,
        );
        studio.do(
            setValue(studio.state.tokens, "color.text.default", "{color.neutral.100}", darkOptions),
        );
        await studio.save?.();
        expect(studio.state.saved).toMatchObject({ conflicts: [expect.anything()] });
    });

    it("doesn't throw when a save fails, and keeps studio's own words for why alone", async () => {
        const { studio } = createSavingStudio(async () => {
            throw new UserFacingError("Couldn't reach GitHub. Try again.");
        });
        studio.do(
            setValue(studio.state.tokens, "color.text.default", "{color.neutral.100}", darkOptions),
        );
        expect(await studio.save?.()).toBeUndefined();
        expect(studio.state.saved).toStrictEqual({ failed: "Couldn't reach GitHub. Try again." });
        expect(studio.state.saving).toBe(false);
    });

    it('puts "Save failed:" before any other failure\'s words', async () => {
        const { studio } = createSavingStudio(async () => {
            throw new Error("EACCES: permission denied, open 'dark.json'");
        });
        studio.do(
            setValue(studio.state.tokens, "color.text.default", "{color.neutral.100}", darkOptions),
        );
        await studio.save?.();
        expect(studio.state.saved).toStrictEqual({
            failed: "Save failed: EACCES: permission denied, open 'dark.json'",
        });
    });
});
