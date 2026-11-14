import { describe, expect, it } from "vitest";
import { createSession, keepYours, remove, rename, setValue } from "../src/index.js";
import { at, changed, demo, opsIn } from "./helpers.js";

const red = { colorSpace: "srgb", components: [1, 0, 0] };
const blue = { colorSpace: "srgb", components: [0, 0, 1] };
const brand = ["color", "brand", "500"];

function clashOf(session: ReturnType<typeof createSession>, fresh: typeof demo) {
    const [clash] = session.rebase(fresh);
    if (!clash) throw new Error("no clash");
    return clash;
}

describe("keepYours", () => {
    it("writes yours over theirs at every place your step changes", () => {
        const session = createSession(demo);
        session.do(setValue(session.tokens, "color.brand.500", red));
        const clash = clashOf(session, changed(demo, [["color.json", [...brand, "$value"], blue]]));
        const [part] = clash.parts;

        const done = session.do(keepYours(session.tokens, clash));

        expect(done.tokens && at(done.tokens, "color.json", [...brand, "$value"])).toEqual(red);
        expect(opsIn(session.unsavedEdits)).toEqual([
            {
                kind: "set",
                file: "color.json",
                jsonPath: brand,
                value: part?.yours,
                was: part?.theirs,
            },
        ]);
    });

    it("removes what they changed when you removed it", () => {
        const session = createSession(demo);
        session.do(remove(session.tokens, "radius.full"));
        const clash = clashOf(
            session,
            changed(demo, [
                ["radius.json", ["radius", "full", "$value"], { value: 1000, unit: "px" }],
            ]),
        );

        session.do(keepYours(session.tokens, clash));

        expect(session.tokens.has("radius.full")).toBe(false);
    });

    it("is refused when they removed or renamed what you changed, saying why", () => {
        const session = createSession(demo);
        session.do(setValue(session.tokens, "color.brand.500", red));
        const clash = clashOf(session, changed(demo, [["color.json", brand, undefined]]));

        expect(keepYours(session.tokens, clash).refusal).toMatchObject({
            kind: "removed-since",
            path: "color.brand.500",
            file: "color.json",
            reason: expect.any(String),
        });
    });

    it("is refused for a rename when the key was renamed or removed elsewhere", () => {
        const session = createSession(demo);
        session.do(rename(session.tokens, "color.text.default", "defaultttttt"));
        const clash = clashOf(
            session,
            changed(demo, [["color.json", ["color", "text", "default"], undefined]]),
        );

        expect(keepYours(session.tokens, clash).refusal?.kind).toBe("removed-since");
    });
});
