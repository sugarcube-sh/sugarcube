    import { describe, expect, it } from "vitest";
import { createStore as createVanillaStore } from "zustand/vanilla";
import type { Host } from "../src/host/types";
import { createTokenStore } from "../src/store/create-token-store";
import type { TokenSnapshot } from "../src/tokens/types";
import { resolved, snapshot } from "./fixtures";

const PATH = "color.brand";

function setup(initial: string) {
    const baseline = createVanillaStore<TokenSnapshot>(() =>
        snapshot({ resolved: resolved({ path: PATH, value: initial, type: "color" }) }),
    );

    const host = {
        baseline,
        save: async () => ({ kind: "persisted" }) as const,
        discard: async () => {},
        capabilities: {} as Host["capabilities"],
    } satisfies Host;

    const { store, getPathIndex } = createTokenStore(host);

    const read = (path = PATH) =>
        getPathIndex().readValue(store.getState().resolved, path, store.getState().currentContext);

    const write = (value: string, path = PATH) =>
        store.getState().setToken(path, value, store.getState().currentContext);

    const pushBaseline = (value: string) =>
        baseline.setState(snapshot({ resolved: resolved({ path: PATH, value, type: "color" }) }));

    return { store, read, write, pushBaseline };
}

describe("createTokenStore - resetToken", () => {
    it("restores the baseline value after an edit", () => {
        const { store, read, write } = setup("{color.pink.500}");

        write("{color.blue.500}");
        expect(read()).toBe("{color.blue.500}");

        store.getState().resetToken(PATH);

        expect(read()).toBe("{color.pink.500}");
    });

    it("resets to the live baseline after a disk reload, not the one captured at startup", () => {
        const { store, read, write, pushBaseline } = setup("{color.pink.500}");

        write("{color.blue.500}");
        pushBaseline("{color.green.500}");

        store.getState().resetToken(PATH);

        expect(read()).toBe("{color.green.500}");
    });

    it("is a no-op for a token the baseline doesn't have", () => {
        const { store, read } = setup("{color.pink.500}");

        expect(() => store.getState().resetToken("color.does.not.exist")).not.toThrow();
        expect(read()).toBe("{color.pink.500}");
    });
});
