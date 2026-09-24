import type { PanelSection, ResolvedTokens, ScaleExtension } from "@sugarcube-sh/core/client";
import { describe, expect, it } from "vitest";
import { createStore as createVanillaStore } from "zustand/vanilla";
import { createScaleState } from "../src/store/scale-state";
import { PathIndex } from "../src/tokens/path-index";
import type { TokenSnapshot } from "../src/tokens/types";
import { snapshot, tree } from "./fixtures";
import { stubTokenStore } from "./text-sources";

const makeScale = (override: Partial<ScaleExtension> = {}): ScaleExtension =>
    ({
        mode: "exponential",
        base: { min: { value: 1, unit: "rem" }, max: { value: 1, unit: "rem" } },
        ratio: { min: 1.2, max: 1.2 },
        steps: { negative: 0, positive: 2 },
        ...override,
    }) as ScaleExtension;

function setup(initialBaseline: TokenSnapshot) {
    const panel: PanelSection[] = [
        {
            title: "Size",
            bindings: [{ type: "scale", token: "size.step.*", base: "size.step.0" }],
        },
    ];
    const pathIndex = new PathIndex(initialBaseline.resolved);

    const tokenStore = stubTokenStore(initialBaseline.resolved);

    const baseline = createVanillaStore<TokenSnapshot>(() => initialBaseline);

    const writes: ResolvedTokens[] = [];
    const { store: scaleState, activate } = createScaleState(
        panel,
        initialBaseline,
        () => pathIndex,
        tokenStore,
        baseline,
        (resolved) => writes.push(resolved),
    );
    const teardown = activate();

    return { scaleState, baseline, writes, teardown };
}

describe("createScaleState - baseline subscription", () => {
    it("clears scale-extension edits when the baseline emits an update", () => {
        const initial = snapshot({
            trees: [
                tree("size.json", {
                    size: {
                        step: {
                            $extensions: { "sh.sugarcube": { scale: makeScale() } },
                        },
                    },
                }),
            ],
        });
        const { scaleState, baseline } = setup(initial);

        scaleState
            .getState()
            .updateScale("size.step.*", () => makeScale({ ratio: { min: 1.5, max: 1.5 } }));
        expect(scaleState.getState().edits["size.step.*"]).not.toBeUndefined();

        baseline.setState({
            ...initial,
            trees: [
                tree("size.json", {
                    size: {
                        step: {
                            $extensions: {
                                "sh.sugarcube": {
                                    scale: makeScale({ ratio: { min: 1.5, max: 1.5 } }),
                                },
                            },
                        },
                    },
                }),
            ],
        });

        expect(scaleState.getState().edits["size.step.*"]).toBeUndefined();
    });

    it("clears edits even on a no-op baseline emission", () => {
        const initial = snapshot({
            trees: [
                tree("size.json", {
                    size: {
                        step: {
                            $extensions: { "sh.sugarcube": { scale: makeScale() } },
                        },
                    },
                }),
            ],
        });
        const { scaleState, baseline } = setup(initial);

        scaleState
            .getState()
            .updateScale("size.step.*", () => makeScale({ ratio: { min: 1.5, max: 1.5 } }));
        expect(scaleState.getState().edits["size.step.*"]).not.toBeUndefined();

        baseline.setState({ ...initial });

        expect(scaleState.getState().edits["size.step.*"]).toBeUndefined();
    });
});
