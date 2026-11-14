import { describe, expect, it } from "vitest";
import { moveListItem, removeListItem } from "../../src/controllers/lists";

describe("moved and without", () => {
    it("moves an item in a list and takes one out", () => {
        expect(moveListItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
        expect(moveListItem(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
        expect(removeListItem(["a", "b", "c"], 1)).toEqual(["a", "c"]);
    });
});
