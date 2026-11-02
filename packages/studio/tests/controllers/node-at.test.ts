import { describe, expect, it } from "vitest";
import { nodeAt } from "../../src/controllers/views";
import { demoMessage, studioOn, withFile } from "./demo-message";

function halfRenamed() {
    const color = demoMessage().files["color.json"] ?? "";
    return studioOn(withFile("color.json", color.replace('"default": {', '"body": {')));
}

describe("nodeAt", () => {
    it("gives the token from the theme shown when that theme has it", () => {
        const { tokens, showing } = studioOn().state;

        const found = nodeAt(tokens, showing, "color.text.default");

        expect(found?.node).toBe(showing.getToken("color.text.default"));
        expect(found?.shown).toBe(true);
    });

    it("gives the token from a theme that has it when the theme shown doesn't, so its page is never a dead end", () => {
        const { tokens, showing } = halfRenamed().state;
        const dark = tokens.getPermutation({ mode: "dark" });

        const found = nodeAt(tokens, showing, "color.text.default");

        expect(found?.node).toBe(dark.getToken("color.text.default"));
        expect(found?.shown).toBe(false);
    });

    it("finds a group the same way", () => {
        const { tokens, showing } = studioOn().state;

        expect(nodeAt(tokens, showing, "color.text")?.node).toBe(showing.getGroup("color.text"));
    });

    it("gives nothing where no theme has anything", () => {
        const { tokens, showing } = studioOn().state;

        expect(nodeAt(tokens, showing, "color.nothing")).toBeUndefined();
    });
});
