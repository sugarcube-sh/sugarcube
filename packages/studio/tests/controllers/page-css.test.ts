import { describe, expect, it } from "vitest";
import { watchCSS } from "../../src/controllers/page-css";
import {
    toSentConfig,
    demoMessage,
    createDemoStudio,
    createSugarcubeAdapterMessage,
} from "./demo-message";

const runNow = (run: () => void) => run();

describe("watchCSS", () => {
    it("sends the page the token CSS at once", () => {
        const studio = createDemoStudio(demoMessage());
        const sent: string[] = [];

        watchCSS(studio, (css) => sent.push(css), runNow);

        expect(sent).toEqual([studio.state.css]);
    });

    it("sends it again when the CSS changes", () => {
        const studio = createDemoStudio(demoMessage());
        const sent: string[] = [];
        watchCSS(studio, (css) => sent.push(css), runNow);

        studio.receive(
            demoMessage({
                adapter: createSugarcubeAdapterMessage({
                    config: toSentConfig({
                        resolver: "tokens.resolver.json",
                        variables: { prefix: "ds" },
                    }),
                }),
            }),
        );

        expect(sent).toHaveLength(2);
        expect(sent[1]).toContain("--ds-color-text-onBrand:");
    });

    it("sends nothing new when only the theme shown changes", () => {
        const studio = createDemoStudio(demoMessage());
        const sent: string[] = [];
        watchCSS(studio, (css) => sent.push(css), runNow);

        studio.show({ mode: "dark" });

        expect(sent).toHaveLength(1);
    });

    it("sends once for changes that land before the next frame", () => {
        const studio = createDemoStudio(demoMessage());
        const sent: string[] = [];
        const frames: (() => void)[] = [];
        watchCSS(
            studio,
            (css) => sent.push(css),
            (run) => frames.push(run),
        );

        studio.receive(
            demoMessage({
                adapter: createSugarcubeAdapterMessage({
                    config: toSentConfig({
                        resolver: "tokens.resolver.json",
                        variables: { prefix: "a" },
                    }),
                }),
            }),
        );
        studio.receive(
            demoMessage({
                adapter: createSugarcubeAdapterMessage({
                    config: toSentConfig({
                        resolver: "tokens.resolver.json",
                        variables: { prefix: "b" },
                    }),
                }),
            }),
        );
        for (const frame of frames.splice(0)) frame();

        expect(sent).toHaveLength(1);
        expect(sent[0]).toContain("--b-color");
    });

    it("stops when told to", () => {
        const studio = createDemoStudio(demoMessage());
        const sent: string[] = [];
        const stop = watchCSS(studio, (css) => sent.push(css), runNow);

        stop();
        studio.receive(
            demoMessage({
                adapter: createSugarcubeAdapterMessage({
                    config: toSentConfig({
                        resolver: "tokens.resolver.json",
                        variables: { prefix: "ds" },
                    }),
                }),
            }),
        );

        expect(sent).toHaveLength(1);
    });
});
