import { type DesignTokens, readFromMemory } from "@sugarcube-sh/dtcg";
import { describe, expect, it, vi } from "vitest";
import {
    apply,
    create,
    createSession,
    remove,
    rename,
    setDescription,
    setValue,
} from "../src/index.js";
import { demo, opsIn } from "./helpers.js";
const red = { colorSpace: "srgb", components: [1, 0, 0] };

describe("createSession", () => {
    it("has nothing unsaved before an edit", () => {
        const session = createSession(demo);

        expect(session.tokens).toBe(demo);
        expect(session.opened).toBe(demo);
        expect(session.unsaved).toEqual({ steps: [] });
        expect(session.changes()).toEqual([]);
    });

    it("keeps an edit as the edit to its file, and moves the design tokens on", () => {
        const session = createSession(demo);
        const done = session.do(setValue(session.tokens, "color.brand.500", red));

        expect(done.tokens).toBe(session.tokens);
        expect(opsIn(session.unsaved)).toEqual([
            expect.objectContaining({ kind: "set", file: "color.json" }),
        ]);
        expect(session.unsaved).not.toHaveProperty("files");
        expect(
            session.tokens.getPermutation().getToken("color.brand.500")?.original?.value,
        ).toEqual(red);
        expect(session.opened).toBe(demo);
    });

    it("keeps the edits in the order they were made", () => {
        const session = createSession(demo);
        session.do(setValue(session.tokens, "color.brand.500", red));
        session.do(setDescription(session.tokens, "color.brand.500", "The anchor."));

        expect(opsIn(session.unsaved).map((op) => op.kind)).toEqual(["set", "set"]);
        expect(opsIn(session.unsaved).map((op) => "jsonPath" in op && op.jsonPath.at(-1))).toEqual([
            "$value",
            "$description",
        ]);
    });

    it("keeps each operation as one step, with every file it changes and the moves it made", () => {
        const session = createSession(demo);

        session.do(rename(session.tokens, "color.text.default", "body"));

        expect(session.unsaved.steps).toHaveLength(1);
        expect(session.unsaved.steps[0]?.ops.map((op) => op.file)).toEqual([
            "color.json",
            "dark.json",
        ]);
        expect(session.unsaved.steps[0]?.moved).toEqual([
            { from: "color.text.default", to: "color.text.body" },
        ]);
    });

    it("keeps one step for each operation, in the order they were done", () => {
        const session = createSession(demo);
        session.do(setValue(session.tokens, "radius.md", { value: 1, unit: "rem" }));
        session.do(rename(session.tokens, "radius.md", "medium"));

        expect(session.unsaved.steps.map((step) => step.ops.map((op) => op.kind))).toEqual([
            ["set"],
            ["renameKey"],
        ]);
    });

    it("changes nothing when the operation asks a question or is refused", () => {
        const session = createSession(demo);
        const heard = vi.fn();
        session.subscribe(heard);
        const answer = session.do(setValue(session.tokens, "color.nope", red));

        expect(answer).toMatchObject({ refused: { kind: "not-found" } });
        expect(session.tokens).toBe(demo);
        expect(opsIn(session.unsaved)).toEqual([]);
        expect(heard).not.toHaveBeenCalled();
    });

    it("lists what changed since it was opened, as the design tokens' diff does with the moves made", () => {
        const session = createSession(demo);
        session.do(setValue(session.tokens, "color.brand.500", red));
        session.do(rename(session.tokens, "color.brand.300", "350"));

        expect(session.changes()).toEqual(
            session.tokens.getChangesSince(demo, {
                moves: session.unsaved.steps.flatMap((step) => step.moved),
            }),
        );
        expect(session.changes().map((change) => [change.kind, change.path])).toContainEqual([
            "renamed",
            "color.brand.350",
        ]);
    });

    it("puts every file back exactly on discard", () => {
        const session = createSession(demo);
        session.do(setValue(session.tokens, "color.brand.500", red));
        session.do(create(session.tokens, "color.highlight", { $type: "color", $value: red }));
        session.discard();

        expect(session.tokens).toBe(demo);
        expect(session.tokens.toMemory().files).toEqual(demo.toMemory().files);
        expect(session.unsaved).toEqual({ steps: [] });
        expect(session.changes()).toEqual([]);
    });

    it("measures from the saved version once saved, and discards back to it", () => {
        const session = createSession(demo);
        session.do(setValue(session.tokens, "color.brand.500", red));
        const saved = session.tokens;
        session.markSaved();

        expect(session.opened).toBe(saved);
        expect(session.unsaved).toEqual({ steps: [] });
        expect(session.changes()).toEqual([]);

        session.do(setDescription(session.tokens, "color.brand.500", "The anchor."));
        session.discard();
        expect(session.tokens).toBe(saved);
    });

    it("marks only the edits that were saved, keeping one done while they were saving", () => {
        const session = createSession(demo);
        session.do(setValue(session.tokens, "color.brand.500", red));
        const sent = session.unsaved;
        const saved = session.tokens;
        session.do(setDescription(session.tokens, "color.brand.500", "The anchor."));
        const later = session.unsaved.steps[1];

        session.markSaved(sent);

        expect(session.opened.toMemory().files).toEqual(saved.toMemory().files);
        expect(session.unsaved.steps).toEqual([later]);
        expect(session.changes().map(({ kind, path }) => [kind, path])).toEqual([
            ["changed", "color.brand.500"],
        ]);
        session.discard();
        expect(session.tokens.toMemory().files).toEqual(saved.toMemory().files);
    });

    it("marks nothing saved when the edits saved are no longer the ones it holds", () => {
        const session = createSession(demo);
        session.do(setValue(session.tokens, "color.brand.500", red));
        const sent = session.unsaved;
        session.discard();
        session.do(setDescription(session.tokens, "color.brand.500", "The anchor."));
        const held = session.unsaved;

        session.markSaved(sent);

        expect(session.unsaved).toBe(held);
        expect(session.opened).toBe(demo);
    });

    it("keeps ids through a save of some of the edits", () => {
        const session = createSession(demo);
        session.do(rename(session.tokens, "color.brand.500", "550"));
        const sent = session.unsaved;
        session.do(rename(session.tokens, "color.brand.550", "555"));

        session.markSaved(sent);
        session.discard();

        expect(session.pathOf("color.brand.500")).toBe("color.brand.550");
    });

    it("tells listeners about every change until they stop listening", () => {
        const session = createSession(demo);
        const heard = vi.fn();
        const stop = session.subscribe(heard);
        session.do(setValue(session.tokens, "color.brand.500", red));
        session.markSaved();
        session.do(setValue(session.tokens, "color.brand.500", { ...red, alpha: 0.5 }));
        session.discard();

        expect(heard).toHaveBeenCalledTimes(4);
        stop();
        session.do(setValue(session.tokens, "color.brand.500", red));
        expect(heard).toHaveBeenCalledTimes(4);
    });

    it("gives back the same tokens when the unsaved edits are applied to the opened files and read again", () => {
        const session = createSession(demo);
        session.do(setValue(session.tokens, "color.brand.500", red));
        session.do(
            setValue(
                session.tokens,
                "radius.md",
                { value: 0.5, unit: "rem" },
                {
                    input: { mode: "dark" },
                },
            ),
        );
        session.do(create(session.tokens, "color.highlight", { $type: "color", $value: red }));
        session.do(create(session.tokens, "motion2", { group: true }));
        session.do(remove(session.tokens, "color.brand.50"));
        session.do(rename(session.tokens, "color.brand", "primary"));
        const replayed = apply(demo, opsIn(session.unsaved));
        if (replayed.conflicts) throw new Error(JSON.stringify(replayed.conflicts));
        expect(replayed.tokens.toMemory().files).toEqual(session.tokens.toMemory().files);
        const plain = (tokens: DesignTokens) => JSON.parse(JSON.stringify(tokens));
        expect(plain(replayed.tokens)).toStrictEqual(plain(session.tokens));
    });
});

describe("ids", () => {
    it("gives a token or group its path when opened as its id", () => {
        const session = createSession(demo);

        expect(session.idOf("color.brand.500")).toBe("color.brand.500");
        expect(session.pathOf("color.brand.500")).toBe("color.brand.500");
        expect(session.idOf("color.brand")).toBe("color.brand");
        expect(session.idOf("color.nope")).toBeUndefined();
        expect(session.pathOf("color.nope")).toBeUndefined();
    });

    it("keeps a token's id through a rename, and the ids inside a renamed group", () => {
        const session = createSession(demo);
        session.do(rename(session.tokens, "color.brand.500", "550"));

        expect(session.pathOf("color.brand.500")).toBe("color.brand.550");
        expect(session.idOf("color.brand.550")).toBe("color.brand.500");
        expect(session.idOf("color.brand.500")).toBeUndefined();

        session.do(rename(session.tokens, "color.brand", "house"));
        expect(session.pathOf("color.brand.500")).toBe("color.house.550");
        expect(session.pathOf("color.brand.300")).toBe("color.house.300");
        expect(session.pathOf("color.brand")).toBe("color.house");
    });

    it("gives a token made in the session an id of its own", () => {
        const session = createSession(demo);
        session.do(create(session.tokens, "color.highlight", { $type: "color", $value: red }));
        const id = session.idOf("color.highlight");

        expect(id).toMatch(/^new:/);
        expect(session.pathOf(id ?? "")).toBe("color.highlight");
    });

    it("forgets a removed token's id, and gives a token made again at its path a new one", () => {
        const session = createSession(demo);
        session.do(remove(session.tokens, "color.brand.50"));

        expect(session.pathOf("color.brand.50")).toBeUndefined();
        expect(session.idOf("color.brand.50")).toBeUndefined();

        session.do(create(session.tokens, "color.brand.50", { $value: red }));
        expect(session.idOf("color.brand.50")).toMatch(/^new:/);
        expect(session.pathOf("color.brand.50")).toBeUndefined();
    });

    it("doesn't give a renamed-away path's id to what is made there next", () => {
        const session = createSession(demo);
        session.do(rename(session.tokens, "color.brand.500", "550"));
        session.do(create(session.tokens, "color.brand.500", { $value: red }));

        expect(session.idOf("color.brand.500")).toMatch(/^new:/);
        expect(session.pathOf("color.brand.500")).toBe("color.brand.550");
    });

    it("puts ids back on discard, and keeps them through a save", () => {
        const session = createSession(demo);
        session.do(rename(session.tokens, "color.brand.500", "550"));
        session.markSaved();
        expect(session.pathOf("color.brand.500")).toBe("color.brand.550");

        session.do(rename(session.tokens, "color.brand.550", "555"));
        session.discard();
        expect(session.pathOf("color.brand.500")).toBe("color.brand.550");
    });

    it("never gives a made token the id of one whose name looks like a new id", () => {
        const files = { "tokens.json": '{ "new:1": { "$type": "number", "$value": 1 } }' };
        const session = createSession(readFromMemory({ files }));
        session.do(create(session.tokens, "made", { $type: "number", $value: 2 }));

        expect(session.idOf("made")).not.toBe("new:1");
        expect(session.pathOf("new:1")).toBe("new:1");
    });

    it("never gives two tokens the same new id, even after a discard", () => {
        const session = createSession(demo);
        session.do(create(session.tokens, "color.a", { $type: "color", $value: red }));
        const first = session.idOf("color.a");
        session.discard();
        session.do(create(session.tokens, "color.b", { $type: "color", $value: red }));

        expect(session.idOf("color.b")).not.toBe(first);
        expect(session.pathOf(first ?? "")).toBeUndefined();
    });
});
