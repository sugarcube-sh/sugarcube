import { describe, expect, it } from "vitest";
import { createSession, isEdits, remove, rename, setValue } from "../src/index.js";
import { demo } from "./helpers.js";

const step = (ops: unknown[], moves: unknown[] = []) => ({ steps: [{ ops, moves }] });

describe("isEdits", () => {
    it("is true for a session's unsaved edits, sent as JSON and read back", () => {
        const session = createSession(demo);
        session.do(setValue(session.tokens, "color.text.brand", "{color.brand.800}"));
        session.do(remove(session.tokens, "radius.full"));
        session.do(rename(session.tokens, "radius.md", "medium"));

        expect(isEdits(JSON.parse(JSON.stringify(session.unsaved)))).toBe(true);
        expect(isEdits({ steps: [] })).toBe(true);
    });

    it("is false for anything that isn't edits, so a crafted request or link goes no further", () => {
        const crafted = [
            null,
            [],
            "edits",
            { steps: {} },
            { steps: [{ ops: [] }] },
            { ops: [], moves: [] },
            step([{ kind: "bogus", file: "color.json" }]),
            step([{ kind: "set", file: "color.json", path: "color", value: 1, was: 0 }]),
            step([{ kind: "set", file: "color.json", jsonPath: ["color"], value: 1 }]),
            step([{ kind: "add", file: 7, jsonPath: ["color"], value: 1 }]),
            step([{ kind: "add", file: "color.json", jsonPath: [{}], value: 1 }]),
            step([{ kind: "renameKey", file: "color.json", jsonPath: ["a"], was: 1 }]),
            step([{ kind: "deleteFile", file: "color.json", was: 1 }]),
            step([], [{ from: "a" }]),
        ];
        for (const value of crafted) expect(isEdits(value), JSON.stringify(value)).toBe(false);
    });
});
