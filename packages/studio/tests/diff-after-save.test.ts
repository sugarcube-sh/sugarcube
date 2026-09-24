import { describe, expect, it } from "vitest";
import { wired } from "./text-sources";

function setup() {
    const { tokens, diff, stop } = wired();
    const pending = () => diff.store.getState().entries.map((e) => `${e.kind}:${e.handle}`);
    return { tokens, pending, stop };
}

describe("the change bar after a save, on a host that never echoes disk", () => {
    it("shows nothing pending once the save is adopted", () => {
        const { tokens, pending, stop } = setup();
        tokens.store.getState().renameNode("radius.md", "medium");
        expect(pending()).toEqual(["renamed:radius.md"]);

        tokens.store.getState().adopt();

        expect(pending()).toEqual([]);
        stop();
    });

    it("shows an edit to the token that was renamed and saved", () => {
        const { tokens, pending, stop } = setup();
        tokens.store.getState().renameNode("radius.md", "medium");
        tokens.store.getState().adopt();

        tokens.store.getState().setToken("radius.md", { value: 9, unit: "rem" });

        expect(pending()).toEqual(["changed:radius.md"]);
        stop();
    });
});
