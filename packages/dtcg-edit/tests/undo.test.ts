import { describe, expect, it, vi } from "vitest";
import { create, createSession, remove, rename, setDescription, setValue } from "../src/index.js";
import { changed, demo } from "./helpers.js";

const red = { colorSpace: "srgb", components: [1, 0, 0] };
const blue = { colorSpace: "srgb", components: [0, 0, 1] };

describe("undo", () => {
    it("has nothing to undo or redo when opened", () => {
        const session = createSession(demo);

        expect(session.canUndo).toBe(false);
        expect(session.canRedo).toBe(false);
    });

    it("takes back the last step, back to the design tokens before it", () => {
        const session = createSession(demo);
        session.do(setValue(session.tokens, "color.brand.500", red));
        const before = session.tokens;
        const first = session.unsaved.steps[0];
        session.do(setDescription(session.tokens, "color.brand.500", "The anchor."));

        session.undo();

        expect(session.tokens).toBe(before);
        expect(session.unsaved.steps).toEqual([first]);
        expect(session.canUndo).toBe(true);
        expect(session.canRedo).toBe(true);
    });

    it("leaves nothing unsaved once every step is undone", () => {
        const session = createSession(demo);
        session.do(setValue(session.tokens, "color.brand.500", red));
        session.do(remove(session.tokens, "radius.full"));

        session.undo();
        session.undo();

        expect(session.tokens).toBe(demo);
        expect(session.unsaved).toEqual({ steps: [] });
        expect(session.changes()).toEqual([]);
        expect(session.canUndo).toBe(false);
    });

    it("puts a removed token back where it was written, with its id", () => {
        const session = createSession(demo);
        session.do(remove(session.tokens, "color.brand.50"));

        session.undo();

        expect(session.tokens.toMemory().files).toEqual(demo.toMemory().files);
        expect(session.idOf("color.brand.50")).toBe("color.brand.50");
        expect(session.pathOf("color.brand.50")).toBe("color.brand.50");
    });

    it("puts a renamed token's id back on its old path", () => {
        const session = createSession(demo);
        session.do(rename(session.tokens, "color.brand.500", "550"));

        session.undo();

        expect(session.pathOf("color.brand.500")).toBe("color.brand.500");
        expect(session.idOf("color.brand.550")).toBeUndefined();
    });

    it("forgets the id of a token made in the step undone", () => {
        const session = createSession(demo);
        session.do(create(session.tokens, "color.highlight", { $type: "color", $value: red }));
        const id = session.idOf("color.highlight") ?? "";

        session.undo();

        expect(session.pathOf(id)).toBeUndefined();
    });

    it("does nothing, and tells no one, with nothing to undo", () => {
        const session = createSession(demo);
        const heard = vi.fn();
        session.subscribe(heard);

        session.undo();

        expect(session.tokens).toBe(demo);
        expect(heard).not.toHaveBeenCalled();
    });

    it("tells listeners", () => {
        const session = createSession(demo);
        session.do(setValue(session.tokens, "color.brand.500", red));
        const heard = vi.fn();
        session.subscribe(heard);

        session.undo();
        session.redo();

        expect(heard).toHaveBeenCalledTimes(2);
    });
});

describe("redo", () => {
    it("does the last step undone again, as the same step", () => {
        const session = createSession(demo);
        session.do(rename(session.tokens, "color.brand.500", "550"));
        const after = session.tokens;
        const step = session.unsaved.steps[0];

        session.undo();
        session.redo();

        expect(session.tokens).toBe(after);
        expect(session.unsaved.steps).toEqual([step]);
        expect(session.unsaved.steps[0]).toBe(step);
        expect(session.pathOf("color.brand.500")).toBe("color.brand.550");
        expect(session.canRedo).toBe(false);
    });

    it("does steps again in the order they were undone", () => {
        const session = createSession(demo);
        session.do(setValue(session.tokens, "color.brand.500", red));
        const first = session.tokens;
        session.do(setValue(session.tokens, "color.brand.500", blue));
        const second = session.tokens;

        session.undo();
        session.undo();
        session.redo();
        expect(session.tokens).toBe(first);
        session.redo();
        expect(session.tokens).toBe(second);
    });

    it("has nothing to do again once a new edit is done", () => {
        const session = createSession(demo);
        session.do(setValue(session.tokens, "color.brand.500", red));
        session.undo();

        session.do(setValue(session.tokens, "color.brand.500", blue));

        expect(session.canRedo).toBe(false);
        session.redo();
        expect(session.unsaved.steps).toHaveLength(1);
    });

    it("has nothing to do again after a discard", () => {
        const session = createSession(demo);
        session.do(setValue(session.tokens, "color.brand.500", red));
        session.do(setValue(session.tokens, "color.brand.500", blue));
        session.undo();

        session.discard();

        expect(session.canUndo).toBe(false);
        expect(session.canRedo).toBe(false);
    });
});

describe("undo and a save", () => {
    it("stops at a save", () => {
        const session = createSession(demo);
        session.do(setValue(session.tokens, "color.brand.500", red));
        const saved = session.tokens;

        session.markSaved();
        session.undo();

        expect(session.canUndo).toBe(false);
        expect(session.tokens).toBe(saved);
        expect(session.opened).toBe(saved);
    });

    it("can't do again what was undone before a save", () => {
        const session = createSession(demo);
        session.do(setValue(session.tokens, "color.brand.500", red));
        session.do(setValue(session.tokens, "color.brand.500", blue));
        session.undo();

        session.markSaved();

        expect(session.canRedo).toBe(false);
    });

    it("undoes a step done while a save was on its way, and stops at the saved ones", () => {
        const session = createSession(demo);
        session.do(setValue(session.tokens, "color.brand.500", red));
        const sent = session.unsaved;
        const saved = session.tokens;
        session.do(setDescription(session.tokens, "color.brand.500", "The anchor."));

        session.markSaved(sent);
        session.undo();

        expect(session.tokens.toMemory().files).toEqual(saved.toMemory().files);
        expect(session.unsaved).toEqual({ steps: [] });
        expect(session.canUndo).toBe(false);
    });
});

describe("undo after the files change", () => {
    const theirs = () =>
        changed(demo, [["radius.json", ["radius", "md", "$value"], { value: 0.75, unit: "rem" }]]);

    it("still undoes the unsaved steps put back after a change on disk", () => {
        const session = createSession(demo);
        session.do(setValue(session.tokens, "color.brand.500", red));
        session.do(rename(session.tokens, "color.brand.300", "350"));
        const fresh = theirs();
        session.rebase(fresh);

        session.undo();

        expect(session.unsaved.steps).toHaveLength(1);
        expect(session.tokens.text("radius.json")).toBe(fresh.text("radius.json"));
        expect(session.tokens.permutation().token("color.brand.500")?.authored?.value).toEqual(red);
        expect(session.tokens.permutation().token("color.brand.300")).toBeDefined();
        expect(session.pathOf("color.brand.300")).toBe("color.brand.300");

        session.undo();
        expect(session.tokens.toMemory().files).toEqual(fresh.toMemory().files);
        expect(session.changes()).toEqual([]);
    });

    it("keeps the id of a token made in the session through undoing its rename after a change on disk", () => {
        const session = createSession(demo);
        session.do(create(session.tokens, "color.highlight", { $type: "color", $value: red }));
        const id = session.idOf("color.highlight") ?? "";
        session.do(rename(session.tokens, "color.highlight", "glow"));
        session.rebase(theirs());

        session.undo();

        expect(session.pathOf(id)).toBe("color.highlight");
    });

    it("can't do again what was undone before a change on disk", () => {
        const session = createSession(demo);
        session.do(setValue(session.tokens, "color.brand.500", red));
        session.undo();

        session.rebase(theirs());

        expect(session.canRedo).toBe(false);
    });

    it("undoes the steps put back after a reload, one at a time", () => {
        const before = createSession(demo);
        before.do(setValue(before.tokens, "color.brand.500", red));
        before.do(remove(before.tokens, "radius.full"));
        const session = createSession(demo);
        session.restore(before.unsaved);

        session.undo();

        expect(session.tokens.permutation().token("radius.full")).toBeDefined();
        expect(session.tokens.permutation().token("color.brand.500")?.authored?.value).toEqual(red);
        expect(session.idOf("radius.full")).toBe("radius.full");

        session.undo();
        expect(session.tokens.toMemory().files).toEqual(demo.toMemory().files);
        expect(session.canUndo).toBe(false);
    });

    it("does again a step undone after a change on disk", () => {
        const session = createSession(demo);
        session.do(setValue(session.tokens, "color.brand.500", red));
        session.rebase(theirs());
        const after = session.tokens;

        session.undo();
        session.redo();

        expect(session.tokens).toBe(after);
    });
});
