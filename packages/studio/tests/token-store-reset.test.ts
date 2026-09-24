import { describe, expect, it } from "vitest";
import { createStore } from "zustand/vanilla";
import { createSourceStore } from "../src/store/create-source-store";
import type { TokenSnapshot } from "../src/tokens/types";
import { fileNamed, sources } from "./text-sources";

const PATH = "color.text.brand";
const AUTHORED = `"brand": { "$value": "{color.brand.700}" }`;

function setup() {
    const base = sources();
    const disk = createStore<TokenSnapshot>(() => ({
        config: {} as TokenSnapshot["config"],
        trees: [],
        resolved: {},
        defaultContext: null,
        permutations: [],
        sources: base,
    }));
    const { store, activate } = createSourceStore(base, disk);
    const stop = activate();

    const read = (path = PATH) => store.getState().getToken(path);
    const write = (value: string) => store.getState().setToken(PATH, value);

    const pushBaseline = (value: string) => {
        const file = fileNamed(base, "color.json");
        const text = base.files[file] as string;
        if (!text.includes(AUTHORED)) throw new Error("fixture moved");
        disk.setState({
            ...disk.getState(),
            sources: {
                ...base,
                files: {
                    ...base.files,
                    [file]: text.replace(AUTHORED, `"brand": { "$value": "${value}" }`),
                },
            },
        });
    };

    return { store, read, write, pushBaseline, stop };
}

describe("resetToken", () => {
    it("restores the baseline value after an edit", () => {
        const { store, read, write, stop } = setup();

        write("{color.brand.800}");
        expect(read()).toBe("{color.brand.800}");

        store.getState().resetToken(PATH);

        expect(read()).toBe("{color.brand.700}");
        stop();
    });

    it("resets to the live baseline after a disk reload, not the one captured at startup", () => {
        const { store, read, write, pushBaseline, stop } = setup();

        write("{color.brand.800}");
        pushBaseline("{color.brand.900}");

        store.getState().resetToken(PATH);

        expect(read()).toBe("{color.brand.900}");
        stop();
    });

    it("is a no-op for a token the baseline doesn't have", () => {
        const { store, read, stop } = setup();

        expect(() => store.getState().resetToken("color.does.not.exist")).not.toThrow();
        expect(read()).toBe("{color.brand.700}");
        stop();
    });
});
