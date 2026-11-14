import { describe, expect, it } from "vitest";
import { findTokenOrGroup } from "../../src/controllers/views";
import { demoMessage, createDemoStudio, withFile } from "./demo-message";

function halfRenamed() {
    const color = demoMessage().files["color.json"] ?? "";
    return createDemoStudio(withFile("color.json", color.replace('"default": {', '"body": {')));
}

describe("findTokenOrGroup", () => {
    it("gives the token from the theme shown when that theme has it", () => {
        const { tokens, shownPermutation } = createDemoStudio().state;

        const found = findTokenOrGroup(tokens, shownPermutation, "color.text.default");

        expect(found?.node).toBe(shownPermutation.getToken("color.text.default"));
        expect(found?.isShown).toBe(true);
    });

    it("gives the token from a theme that has it when the theme shown doesn't, so its page is never a dead end", () => {
        const { tokens, shownPermutation } = halfRenamed().state;
        const dark = tokens.getPermutation({ mode: "dark" });

        const found = findTokenOrGroup(tokens, shownPermutation, "color.text.default");

        expect(found?.node).toBe(dark.getToken("color.text.default"));
        expect(found?.isShown).toBe(false);
    });

    it("finds a group the same way", () => {
        const { tokens, shownPermutation } = createDemoStudio().state;

        expect(findTokenOrGroup(tokens, shownPermutation, "color.text")?.node).toBe(
            shownPermutation.getGroup("color.text"),
        );
    });

    it("gives nothing where no theme has anything", () => {
        const { tokens, shownPermutation } = createDemoStudio().state;

        expect(findTokenOrGroup(tokens, shownPermutation, "color.nothing")).toBeUndefined();
    });
});
