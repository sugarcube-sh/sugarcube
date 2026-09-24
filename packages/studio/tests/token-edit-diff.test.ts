import { describe, expect, it } from "vitest";
import { pendingKey } from "../src/store/create-diff-store";
import { wired } from "./text-sources";

const PATH = "radius.md";

const setup = () => wired();

describe("a token-level edit reaches the change bar", () => {
    it("puts the edited token in the diff store", () => {
        const { tokens, diff, stop } = setup();

        const context = tokens.store.getState().currentContext;
        tokens.store.getState().setToken(PATH, { value: 0.5, unit: "rem" }, context);

        expect(diff.store.getState().entries.map((entry) => entry.path)).toEqual([PATH]);

        stop();
    });

    it("marks the token pending, which is what disables the row reset", () => {
        const { tokens, diff, stop } = setup();

        const context = tokens.store.getState().currentContext;
        tokens.store.getState().setToken(PATH, { value: 0.5, unit: "rem" }, context);

        const { pendingPaths } = diff.store.getState();
        expect(
            pendingPaths.has(pendingKey(PATH)) || pendingPaths.has(pendingKey(PATH, context)),
        ).toBe(true);

        stop();
    });
});
