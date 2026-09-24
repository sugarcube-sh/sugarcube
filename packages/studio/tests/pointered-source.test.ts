import { describe, expect, it } from "vitest";
import { placementFor } from "../src/mvp/placement";
import {
    create,
    openDocument,
    remove,
    rename,
    setDescription,
    setValue,
    writableFiles,
} from "../src/tokens/source-document";

const RESOLVER = `{
  "name": "inline",
  "sets": {
    "base": {
      "sources": [{ "color": { "$type": "color", "x": { "$value": "#000" } } }]
    }
  },
  "resolutionOrder": [{ "$ref": "#/sets/base" }, { "$ref": "b.json" }]
}
`;
const WHOLE = `{ "color": { "$type": "color", "y": { "$value": "{color.x}" } } }
`;

function open() {
    return openDocument({
        files: { "tokens.resolver.json": RESOLVER, "b.json": WHOLE },
        order: [
            {
                context: "default",
                sources: [
                    { file: "tokens.resolver.json", pointer: "/sets/base/sources/0" },
                    { file: "b.json" },
                ],
            },
        ],
    });
}

describe("a source read through a pointer", () => {
    it("is not a file Studio will write", () => {
        expect(writableFiles(open().sources)).toEqual(["b.json"]);
    });

    it("refuses every write into it", () => {
        const doc = open();
        const color = doc.index.handleAt("color") as string;

        expect(setValue(doc, "color.x", "#fff", "default")).toBeNull();
        expect(setDescription(doc, "color.x", "inline", "default")).toBeNull();
        expect(rename(doc, "color.x", "w")).toBeNull();
        expect(remove(doc, "color.x")).toBeNull();
        expect(
            create(doc, {
                parent: color,
                name: "z",
                sourcePath: "tokens.resolver.json",
                token: { $type: "color", $value: "#123" },
            }),
        ).toBeNull();
        expect(
            create(doc, { parent: color, name: "g", sourcePath: "tokens.resolver.json" }),
        ).toBeNull();
    });

    it("still takes a write to a whole file in the same document", () => {
        const doc = open();
        const next = setValue(doc, "color.y", "#fff", "default");

        expect(next?.index.readValue(next.resolved, "color.y", "default")).toBe("#fff");
        expect(next?.ops).toEqual([
            { kind: "set", file: "b.json", path: ["color", "y", "$value"], value: "#fff" },
        ]);
    });

    it("is never offered as a place for a new token", () => {
        const doc = open();
        const writable = new Set(writableFiles(doc.sources));

        expect(placementFor(doc.index, doc.resolved, "default", undefined, writable)).toEqual({
            kind: "settled",
            sourcePath: "b.json",
        });
    });
});
