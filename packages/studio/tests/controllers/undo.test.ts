import { setValue } from "@sugarcube-sh/dtcg-edit";
import { describe, expect, it } from "vitest";
import { createStudio } from "../../src/controllers/studio";
import { changeBarActions, fieldKey, isTyping, undoFor, undoKey } from "../../src/controllers/undo";
import { adapterFor } from "../../src/adapters";
import type { SaveOutcome } from "../../src/protocol";
import { demoMessage, studioOn } from "./demo-message";

const red = { colorSpace: "srgb", components: [1, 0, 0] };
const blue = { colorSpace: "srgb", components: [0, 0, 1] };
const brand = "value color.brand.500 base";

describe("undo and redo in studio", () => {
    it("takes back the last edit, and does it again", () => {
        const studio = studioOn(demoMessage());
        const opened = studio.state.tokens;
        studio.do(setValue(studio.state.tokens, "color.brand.500", red));
        const edited = studio.state.tokens;

        studio.undo();
        expect(studio.state.tokens).toBe(opened);
        expect(studio.state.canUndo).toBe(false);
        expect(studio.state.canRedo).toBe(true);
        expect(studio.state.changes).toEqual([]);

        studio.redo();
        expect(studio.state.tokens).toBe(edited);
        expect(studio.state.canUndo).toBe(true);
        expect(studio.state.canRedo).toBe(false);
    });

    it("makes edits to one field one after another one step", () => {
        const studio = studioOn(demoMessage());
        studio.do(setValue(studio.state.tokens, "color.brand.500", red), { merge: brand });
        studio.do(setValue(studio.state.tokens, "color.brand.500", blue), { merge: brand });

        expect(studio.unsaved.steps).toHaveLength(1);
    });

    it("ends the step when a save starts, so the step being sent can't change", async () => {
        let finish = (_outcome: SaveOutcome) => {};
        const studio = createStudio(
            demoMessage(),
            adapterFor,
            () => new Promise<SaveOutcome>((resolve) => (finish = resolve)),
        );
        studio.do(setValue(studio.state.tokens, "color.brand.500", red), { merge: brand });
        const saving = studio.save?.();
        studio.do(setValue(studio.state.tokens, "color.brand.500", blue), { merge: brand });

        expect(studio.unsaved.steps).toHaveLength(2);
        finish({ written: ["color.json"], deleted: [] });
        await saving;
        expect(studio.unsaved.steps).toHaveLength(1);
        expect(studio.state.canUndo).toBe(true);
    });

    it("says a save is on its way until it ends, however it ends", async () => {
        let finish = (_outcome: SaveOutcome) => {};
        let fail = (_error: Error) => {};
        const studio = createStudio(
            demoMessage(),
            adapterFor,
            () =>
                new Promise<SaveOutcome>((resolve, reject) => {
                    finish = resolve;
                    fail = reject;
                }),
        );
        studio.do(setValue(studio.state.tokens, "color.brand.500", red));
        expect(studio.state.saving).toBe(false);

        const first = studio.save?.();
        expect(studio.state.saving).toBe(true);
        finish({ written: ["color.json"], deleted: [] });
        await first;
        expect(studio.state.saving).toBe(false);

        studio.do(setValue(studio.state.tokens, "color.brand.500", blue));
        const second = studio.save?.();
        fail(new Error("offline"));
        expect(await second).toBeUndefined();
        expect(studio.state.saved).toStrictEqual({ failed: "Save failed: offline" });
        expect(studio.state.saving).toBe(false);
    });
});

describe("a field's name", () => {
    const value = { path: "color.brand.500", writes: "value", place: "base" };

    it("is the same for every edit to one field", () => {
        expect(fieldKey(value)).toBe(fieldKey({ ...value }));
    });

    it("differs for each place a token is written", () => {
        expect(fieldKey(value)).not.toBe(fieldKey({ ...value, place: "mode: dark" }));
    });

    it("differs for what is written", () => {
        expect(fieldKey(value)).not.toBe(fieldKey({ ...value, writes: "description" }));
    });

    it("differs for each part of a value", () => {
        const color = fieldKey({ ...value, part: ["color"] });
        expect(color).not.toBe(fieldKey(value));
        expect(color).not.toBe(fieldKey({ ...value, part: ["blur"] }));
        expect(fieldKey({ ...value, part: [0, "color"] })).not.toBe(
            fieldKey({ ...value, part: [1, "color"] }),
        );
    });

    it("differs for each control of a colour", () => {
        expect(fieldKey({ ...value, control: "space" })).not.toBe(
            fieldKey({ ...value, control: "channel 0" }),
        );
    });
});

describe("the change bar's buttons", () => {
    const saving = () => {
        let finish = (_outcome: SaveOutcome) => {};
        const studio = createStudio(
            demoMessage(),
            adapterFor,
            () => new Promise<SaveOutcome>((resolve) => (finish = resolve)),
        );
        return { studio, finish: () => finish({ written: ["color.json"], deleted: [] }) };
    };

    it("offers each when there is something for it to do", () => {
        const { studio } = saving();
        studio.do(setValue(studio.state.tokens, "color.brand.500", red));
        studio.do(setValue(studio.state.tokens, "color.brand.500", blue));
        studio.undo();

        expect(changeBarActions(studio)).toEqual({
            undo: true,
            redo: true,
            discard: true,
            save: true,
        });
    });

    it("offers nothing before an edit", () => {
        expect(changeBarActions(saving().studio)).toEqual({
            undo: false,
            redo: false,
            discard: false,
            save: false,
        });
    });

    it("offers nothing that changes the edits while a save is on its way", async () => {
        const { studio, finish } = saving();
        studio.do(setValue(studio.state.tokens, "color.brand.500", red));
        studio.do(setValue(studio.state.tokens, "color.brand.500", blue));
        studio.undo();
        const sent = studio.save?.();

        expect(changeBarActions(studio)).toEqual({
            undo: false,
            redo: false,
            discard: false,
            save: false,
        });
        finish();
        await sent;
    });

    it("offers no save where nothing saves", () => {
        const studio = studioOn(demoMessage());
        studio.do(setValue(studio.state.tokens, "color.brand.500", red));

        expect(changeBarActions(studio)).toMatchObject({ discard: true, save: false });
    });

    it("offers no save when the sign-in doesn't allow one", () => {
        const studio = createStudio(demoMessage(), adapterFor, async () => ({
            written: [],
            deleted: [],
        }));
        studio.do(setValue(studio.state.tokens, "color.brand.500", red));

        expect(changeBarActions(studio, { canSave: false })).toMatchObject({ save: false });
        expect(changeBarActions(studio, { canSave: true })).toMatchObject({ save: true });
    });
});

describe("the undo keys", () => {
    const press = (
        key: string,
        held: { meta?: boolean; ctrl?: boolean; shift?: boolean } = {},
    ) => ({
        key,
        metaKey: held.meta ?? false,
        ctrlKey: held.ctrl ?? false,
        shiftKey: held.shift ?? false,
        altKey: false,
    });

    it("undoes with Cmd+Z or Ctrl+Z", () => {
        expect(undoKey(press("z", { meta: true }))).toBe("undo");
        expect(undoKey(press("z", { ctrl: true }))).toBe("undo");
    });

    it("redoes with Shift and either, or Ctrl+Y", () => {
        expect(undoKey(press("Z", { meta: true, shift: true }))).toBe("redo");
        expect(undoKey(press("z", { ctrl: true, shift: true }))).toBe("redo");
        expect(undoKey(press("y", { ctrl: true }))).toBe("redo");
    });

    it("does nothing for Z alone, or with Alt", () => {
        expect(undoKey(press("z"))).toBeUndefined();
        expect(undoKey({ ...press("z", { meta: true }), altKey: true })).toBeUndefined();
    });

    it("leaves the keys to a box being typed in, and takes them from a slider or a button", () => {
        expect(isTyping({ tagName: "INPUT", type: "text", isContentEditable: false })).toBe(true);
        expect(isTyping({ tagName: "INPUT", type: "number", isContentEditable: false })).toBe(true);
        expect(isTyping({ tagName: "TEXTAREA", type: "", isContentEditable: false })).toBe(true);
        expect(isTyping({ tagName: "DIV", type: "", isContentEditable: true })).toBe(true);
        expect(isTyping({ tagName: "INPUT", type: "range", isContentEditable: false })).toBe(false);
        expect(isTyping({ tagName: "INPUT", type: "checkbox", isContentEditable: false })).toBe(
            false,
        );
        expect(isTyping({ tagName: "BUTTON", type: "button", isContentEditable: false })).toBe(
            false,
        );
    });
});

describe("what a key press does", () => {
    const cmdZ = { key: "z", metaKey: true, ctrlKey: false, shiftKey: false, altKey: false };
    const slider = { tagName: "INPUT", type: "range", isContentEditable: false };
    const box = { tagName: "INPUT", type: "text", isContentEditable: false };
    const offered = { undo: true, redo: true, discard: true, save: true };

    it("undoes or redoes when the bar offers it and nothing is being typed in", () => {
        expect(undoFor(cmdZ, slider, offered)).toBe("undo");
        expect(undoFor({ ...cmdZ, shiftKey: true }, slider, offered)).toBe("redo");
    });

    it("does nothing in a box being typed in, or when the bar doesn't offer it", () => {
        expect(undoFor(cmdZ, box, offered)).toBeUndefined();
        expect(undoFor(cmdZ, slider, { ...offered, undo: false })).toBeUndefined();
    });
});
