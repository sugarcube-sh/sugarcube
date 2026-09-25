import { describe, expect, it } from "vitest";
import { type FileWriteOp, WriteOpFailed, applyWriteOps } from "../src/tokens/write-ops";
import { create, openDocument, setValue } from "../src/tokens/source-document";
import { inMemory } from "./text-sources";

const COLOR = `{
  "color": {
    "$type": "color",
    "blue": { "$value": "#00f" }
  }
}
`;
const SPACE = `{ "space": { "$type": "dimension", "md": { "$value": { "value": 1, "unit": "rem" } } } }
`;

const replay = (text: string, ops: FileWriteOp[]) => applyWriteOps(text, ops, "color.json");

describe("an edit replays onto a node that is there, or is a conflict", () => {
    it("refuses an edit to a token that has gone, rather than bringing it back as a stub", () => {
        expect(() =>
            replay(COLOR, [{ kind: "set", path: ["color", "brand", "$value"], value: "#f00" }]),
        ).toThrow(WriteOpFailed);
    });

    it("still sets a field the token did not have yet, like a first description", () => {
        const next = replay(COLOR, [
            { kind: "set", path: ["color", "blue", "$description"], value: "Primary" },
        ]);
        expect(JSON.parse(next).color.blue.$description).toBe("Primary");
    });

    it("refuses a set that carries no value", () => {
        expect(() =>
            replay(COLOR, [{ kind: "set", path: ["color", "blue", "$value"] } as never]),
        ).toThrow(WriteOpFailed);
    });
});

describe("a new node replays as an add", () => {
    it("creates the groups it needs in a file that does not declare them yet", () => {
        const next = applyWriteOps(
            SPACE,
            [
                {
                    kind: "add",
                    path: ["color", "raw", "red"],
                    value: { $type: "color", $value: "#f00" },
                },
            ],
            "space.json",
        );
        expect(JSON.parse(next).color.raw.red.$value).toBe("#f00");
    });

    it("is a conflict when someone else created that node first", () => {
        expect(() =>
            replay(COLOR, [{ kind: "add", path: ["color", "blue"], value: { $value: "#000" } }]),
        ).toThrow(WriteOpFailed);
    });
});

describe("a removal of something already gone", () => {
    it("is nothing to do, even under a group that has gone too", () => {
        expect(replay(COLOR, [{ kind: "remove", path: ["color", "brand"] }])).toBe(COLOR);
        expect(replay(COLOR, [{ kind: "remove", path: ["size", "md"] }])).toBe(COLOR);
    });
});

describe("the message a person reads", () => {
    it("says the file changed since Studio read it, not that a disk did", () => {
        let message = "";
        try {
            replay(COLOR, [{ kind: "set", path: ["color", "brand", "$value"], value: "#f00" }]);
        } catch (error) {
            message = (error as Error).message;
        }
        expect(message).toContain("changed since Studio read it");
        expect(message).not.toContain("disk");
    });
});

describe("what Studio records", () => {
    it("records a new token as an add, so it lands in a file without its group", () => {
        const doc = openDocument(inMemory({ "color.json": COLOR, "space.json": SPACE }));
        const made = create(doc, {
            parent: "color",
            name: "red",
            sourcePath: "space.json",
            token: { $type: "color", $value: "#f00" },
        });

        expect(made?.ops.map((op) => op.kind)).toEqual(["add"]);
        expect(JSON.parse(made?.sources.files["space.json"] ?? "{}").color.red.$value).toBe("#f00");
    });

    it("records a value edit as a set", () => {
        const doc = openDocument(inMemory({ "color.json": COLOR }));
        const edited = setValue(doc, "color.blue", "#0000ff", "default");
        expect(edited?.ops.map((op) => op.kind)).toEqual(["set"]);
    });
});

describe("an edit Studio cannot place", () => {
    it("is refused, not written somewhere it does not belong", () => {
        const doc = openDocument(inMemory({ "color.json": COLOR }));
        const moved = {
            ...doc.sources,
            files: { "color.json": `{ "color": { "$type": "color" } }\n` },
        };
        const stale = { ...doc, sources: moved };

        expect(setValue(stale, "color.blue", "#0000ff", "default")).toBeNull();
    });
});
