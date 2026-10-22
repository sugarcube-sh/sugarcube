import { describe, expect, it } from "vitest";
import { apply, createSession, rename, setDescription, setValue } from "../src/index.js";
import { at, changed, demo, opsIn } from "./helpers.js";

const red = { colorSpace: "srgb", components: [1, 0, 0] };
const green = { colorSpace: "srgb", components: [0, 1, 0] };
const blue = { colorSpace: "srgb", components: [0, 0, 1] };
const brand = "value color.brand.500";

describe("edits merged into one step", () => {
    it("makes edits given the same merge one after another one step, undone as one", () => {
        const session = createSession(demo);
        session.do(setValue(session.tokens, "color.brand.500", red), { merge: brand });
        session.do(setValue(session.tokens, "color.brand.500", green), { merge: brand });
        session.do(setValue(session.tokens, "color.brand.500", blue), { merge: brand });

        expect(session.unsaved.steps).toHaveLength(1);
        session.undo();
        expect(session.tokens).toBe(demo);
        session.redo();
        expect(session.tokens.permutation().token("color.brand.500")?.authored?.value).toEqual(
            blue,
        );
    });

    it("keeps one edit for a place set again and again: the first was, the last value", () => {
        const session = createSession(demo);
        const was = demo.permutation().token("color.brand.500")?.authored?.value;
        session.do(setValue(session.tokens, "color.brand.500", red), { merge: brand });
        session.do(setValue(session.tokens, "color.brand.500", blue), { merge: brand });

        expect(opsIn(session.unsaved)).toEqual([
            {
                kind: "set",
                file: "color.json",
                jsonPath: ["color", "brand", "500", "$value"],
                value: blue,
                was,
            },
        ]);
    });

    it("keeps one add for a place added and then set", () => {
        const session = createSession(demo);
        const field = "description radius.md";
        session.do(setDescription(session.tokens, "radius.md", "Hi"), { merge: field });
        session.do(setDescription(session.tokens, "radius.md", "Hi there"), { merge: field });

        expect(opsIn(session.unsaved)).toEqual([
            expect.objectContaining({ kind: "add", value: "Hi there" }),
        ]);
    });

    it("keeps one remove, expecting the first was, for a place set and then removed", () => {
        const session = createSession(demo);
        const field = "description radius.md";
        session.do(setDescription(session.tokens, "radius.md", "Hi"));
        session.markSaved();
        session.do(setDescription(session.tokens, "radius.md", "Hi there"), { merge: field });
        session.do(setDescription(session.tokens, "radius.md", null), { merge: field });

        expect(opsIn(session.unsaved)).toEqual([
            expect.objectContaining({ kind: "remove", was: "Hi" }),
        ]);
    });

    it("keeps one set for a place removed and then added again", () => {
        const session = createSession(demo);
        const field = "description radius.md";
        session.do(setDescription(session.tokens, "radius.md", "Hi"));
        session.markSaved();
        session.do(setDescription(session.tokens, "radius.md", null), { merge: field });
        session.do(setDescription(session.tokens, "radius.md", "Hello"), { merge: field });

        expect(opsIn(session.unsaved)).toEqual([
            expect.objectContaining({ kind: "set", was: "Hi", value: "Hello" }),
        ]);
    });

    it("leaves no step when the edits come back to where they started", () => {
        const session = createSession(demo);
        const field = "description radius.md";
        session.do(setValue(session.tokens, "color.brand.300", red));
        const before = session.tokens;
        const first = session.unsaved.steps[0];
        session.do(setDescription(session.tokens, "radius.md", "Hi"), { merge: field });
        session.do(setDescription(session.tokens, "radius.md", null), { merge: field });

        expect(session.unsaved.steps).toEqual([first]);
        expect(session.tokens).toBe(before);
    });

    it("answers with the design tokens it holds when a run comes back to where it started", () => {
        const session = createSession(demo);
        const was = at(demo, "color.json", ["color", "brand", "500", "$value"]) ?? null;
        session.do(setValue(session.tokens, "color.brand.500", red), { merge: brand });
        const done = session.do(setValue(session.tokens, "color.brand.500", was), {
            merge: brand,
        });

        expect(done.tokens).toBe(session.tokens);
    });

    it("leaves no step when a value is set back to what it was", () => {
        const session = createSession(demo);
        const was = at(demo, "color.json", ["color", "brand", "500", "$value"]) ?? null;
        session.do(setValue(session.tokens, "color.brand.500", red), { merge: brand });
        session.do(setValue(session.tokens, "color.brand.500", was), { merge: brand });

        expect(session.unsaved).toEqual({ steps: [] });
        expect(session.tokens).toBe(demo);
        expect(session.canUndo).toBe(false);
    });

    it("starts a new step after one that came to nothing, never joining the step before it", () => {
        const session = createSession(demo);
        const field = "description radius.md";
        session.do(setValue(session.tokens, "color.brand.300", red));
        const first = session.unsaved.steps[0];
        session.do(setDescription(session.tokens, "radius.md", "Hi"), { merge: field });
        session.do(setDescription(session.tokens, "radius.md", null), { merge: field });
        session.do(setDescription(session.tokens, "radius.md", "Hello"), { merge: field });

        expect(session.unsaved.steps).toHaveLength(2);
        expect(session.unsaved.steps[0]).toBe(first);
    });

    it("keeps every edit, in order, when they are to different places", () => {
        const session = createSession(demo);
        const field = "value shadow.sm";
        session.do(
            setValue(session.tokens, "shadow.sm", "{color.neutral.900}", { part: ["color"] }),
            {
                merge: field,
            },
        );
        session.do(
            setValue(session.tokens, "shadow.sm", { value: 2, unit: "px" }, { part: ["blur"] }),
            { merge: field },
        );
        session.do(
            setValue(session.tokens, "shadow.sm", "{color.neutral.700}", { part: ["color"] }),
            {
                merge: field,
            },
        );

        expect(session.unsaved.steps).toHaveLength(1);
        expect(opsIn(session.unsaved).map((op) => "jsonPath" in op && op.jsonPath.at(-1))).toEqual([
            "color",
            "blur",
        ]);
    });

    it("never folds an edit past a later one to the value around it", () => {
        const session = createSession(demo);
        const field = "value shadow.sm";
        const whole = demo.permutation().token("shadow.sm")?.authored?.value;
        session.do(
            setValue(session.tokens, "shadow.sm", "{color.neutral.900}", { part: ["color"] }),
            { merge: field },
        );
        session.do(setValue(session.tokens, "shadow.sm", JSON.parse(JSON.stringify(whole))), {
            merge: field,
        });
        session.do(
            setValue(session.tokens, "shadow.sm", "{color.neutral.700}", { part: ["color"] }),
            { merge: field },
        );

        const replayed = apply(demo, opsIn(session.unsaved));
        expect(replayed.tokens?.toMemory().files).toEqual(session.tokens.toMemory().files);
    });

    it("gives the files the session holds when the merged step is applied to the opened ones", () => {
        const session = createSession(demo);
        const field = "description radius.md";
        session.do(setValue(session.tokens, "color.brand.500", red), { merge: brand });
        session.do(setValue(session.tokens, "color.brand.500", blue), { merge: brand });
        session.do(setDescription(session.tokens, "radius.md", "Hi"), { merge: field });
        session.do(setDescription(session.tokens, "radius.md", "Hi there"), { merge: field });

        const replayed = apply(demo, opsIn(session.unsaved));
        expect(replayed.tokens?.toMemory().files).toEqual(session.tokens.toMemory().files);
    });

    it("keeps the moves of a merged run", () => {
        const session = createSession(demo);
        const field = "name color.brand.500";
        session.do(rename(session.tokens, "color.brand.500", "550"), { merge: field });
        session.do(rename(session.tokens, "color.brand.550", "555"), { merge: field });

        expect(session.unsaved.steps).toHaveLength(1);
        expect(session.pathOf("color.brand.500")).toBe("color.brand.555");
        expect(session.changes().map(({ kind, path }) => [kind, path])).toContainEqual([
            "renamed",
            "color.brand.555",
        ]);
    });
});

describe("what ends a step", () => {
    const twoSteps = (between: (session: ReturnType<typeof createSession>) => void) => {
        const session = createSession(demo);
        session.do(setValue(session.tokens, "color.brand.500", red), { merge: brand });
        between(session);
        session.do(setValue(session.tokens, "color.brand.500", blue), { merge: brand });
        return session;
    };

    it("an edit with another merge", () => {
        const session = createSession(demo);
        session.do(setValue(session.tokens, "color.brand.500", red), { merge: brand });
        session.do(setDescription(session.tokens, "radius.md", "Hi"), { merge: "description" });
        session.do(setValue(session.tokens, "color.brand.500", blue), { merge: brand });

        expect(session.unsaved.steps).toHaveLength(3);
    });

    it("an edit with no merge, before or after", () => {
        const session = createSession(demo);
        session.do(setValue(session.tokens, "color.brand.500", red));
        session.do(setValue(session.tokens, "color.brand.500", green), { merge: brand });
        session.do(setValue(session.tokens, "color.brand.500", blue));

        expect(session.unsaved.steps).toHaveLength(3);
    });

    it("not an edit that was refused", () => {
        const session = twoSteps((each) => {
            each.do(setValue(each.tokens, "color.nope", red), { merge: brand });
        });

        expect(session.unsaved.steps).toHaveLength(1);
    });

    it("ending it by hand", () => {
        expect(twoSteps((each) => each.endStep()).unsaved.steps).toHaveLength(2);
    });

    it("undo and redo", () => {
        const session = twoSteps((each) => {
            each.undo();
            each.redo();
        });

        expect(session.unsaved.steps).toHaveLength(2);
    });

    it("a save", () => {
        const session = twoSteps((each) => each.markSaved());

        expect(session.unsaved.steps).toHaveLength(1);
        expect(session.opened.permutation().token("color.brand.500")?.authored?.value).toEqual(red);
    });

    it("a change on disk", () => {
        const fresh = changed(demo, [
            ["radius.json", ["radius", "md", "$value"], { value: 0.75, unit: "rem" }],
        ]);

        expect(twoSteps((each) => each.rebase(fresh)).unsaved.steps).toHaveLength(2);
    });

    it("edits put back after a reload", () => {
        const kept = createSession(demo);
        kept.do(setDescription(kept.tokens, "radius.md", "Hi"));

        expect(twoSteps((each) => each.restore(kept.unsaved)).unsaved.steps).toHaveLength(3);
    });
});
