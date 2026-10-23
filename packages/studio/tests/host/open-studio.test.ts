import { describe, expect, it, vi } from "vitest";
import { openStudio } from "../../src/host/open-studio";
import type { StudioMessage } from "../../src/protocol";
import { demoMessage, withFile } from "../controllers/demo-message";

function shared(initial?: StudioMessage) {
    let current: StudioMessage | undefined = initial;
    const listeners = new Set<(value: StudioMessage) => void>();
    return {
        value: () => current,
        on: (_event: "updated", listener: (value: StudioMessage) => void) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        send: (next: StudioMessage) => {
            current = next;
            for (const listener of listeners) listener(next);
        },
    };
}

describe("openStudio", () => {
    it("starts the sign-in with the studio it opened", async () => {
        const started: unknown[] = [];
        const signIn = { start: async (studio: unknown) => void started.push(studio) };
        const studio = await openStudio(
            { message: shared(demoMessage()), signIn },
            new AbortController().signal,
        );
        await vi.waitFor(() => expect(started).toStrictEqual([studio]));
    });

    it("opens the message the host has already shared", async () => {
        const studio = await openStudio(
            { message: shared(demoMessage()) },
            new AbortController().signal,
        );

        expect(studio.state.tokens.has("color.text.onBrand")).toBe(true);
    });

    it("waits for a message the host hasn't shared yet", async () => {
        const state = shared();
        const opening = openStudio({ message: state }, new AbortController().signal);

        state.send(demoMessage());

        expect((await opening).state.tokens.has("color.text.onBrand")).toBe(true);
    });

    it("takes in each message the host shares after it opens", async () => {
        const state = shared(demoMessage());
        const studio = await openStudio({ message: state }, new AbortController().signal);
        const dark = demoMessage().files["dark.json"] ?? "";

        state.send(
            withFile("dark.json", dark.replace("{color.neutral.50}", "{color.neutral.100}")),
        );

        expect(studio.state.tokens.text("dark.json")).toContain("{color.neutral.100}");
    });

    it("stops taking in messages once aborted", async () => {
        const state = shared(demoMessage());
        const controller = new AbortController();
        const studio = await openStudio({ message: state }, controller.signal);
        const before = studio.state;

        controller.abort();
        state.send(withFile("dark.json", "{}"));

        expect(studio.state).toBe(before);
    });

    it("saves through the connection's save, and has none when the connection has none", async () => {
        const save = async () => ({ written: [], deleted: [] });
        const saving = await openStudio(
            { message: shared(demoMessage()), save },
            new AbortController().signal,
        );
        const reading = await openStudio(
            { message: shared(demoMessage()) },
            new AbortController().signal,
        );

        expect(saving.save).toBeDefined();
        expect(reading.save).toBeUndefined();
    });

    it("gives up when aborted before a message arrives", async () => {
        const controller = new AbortController();
        const opening = openStudio({ message: shared() }, controller.signal);

        controller.abort();

        await expect(opening).rejects.toThrow("Aborted");
    });

    it("says the host sent nothing when no message arrives in time", async () => {
        const opening = openStudio({ message: shared() }, new AbortController().signal, {
            waitMs: 10,
        });

        await expect(opening).rejects.toThrow(/^\[sugarcube studio\] The host sent no token files/);
    });
});
