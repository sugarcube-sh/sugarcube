import type { PanelSection } from "@sugarcube-sh/core/client";
import { type ReactNode, useEffect, useState } from "react";
import { useHost } from "../host/host-provider";
import { createDiffStore } from "../store/create-diff-store";
import { createSourceStore } from "../store/create-source-store";
import { StudioContext } from "../store/hooks";
import { createScaleState } from "../store/scale-state";
import { directScaleGroups, scaleGroupPaths } from "../tokens/scale-extension";

export function TokenStoreProvider({ children }: { children: ReactNode }) {
    const host = useHost();

    const [{ ctx, activate }] = useState(() => {
        const initialSnapshot = host.baseline.getState();
        const tokens = createSourceStore(initialSnapshot.sources, host.baseline, {
            restore: host.restore,
        });
        if (host.restore && tokens.store.getState().ops.length === 0) host.persist([]);

        const groups = new Set([
            ...scaleGroupPaths(initialSnapshot.trees),
            ...directScaleGroups(tokens.getBaseline().index, initialSnapshot.resolved),
        ]);

        const scales: PanelSection[] = [
            {
                title: "Scales",
                bindings: Array.from(groups, (path) => ({
                    type: "scale" as const,
                    token: `${path}.*`,
                })),
            },
        ];

        const scale = createScaleState(
            scales,
            initialSnapshot,
            tokens.getPathIndex,
            tokens.store,
            host.baseline,
            tokens.writeResolved,
        );
        const diff = createDiffStore(tokens, scale.store);

        const activateAll = (): (() => void) => {
            const teardowns = [
                tokens.activate(),
                scale.activate(),
                diff.activate(),
                tokens.store.subscribe((state, prev) => {
                    if (state.ops !== prev.ops) host.persist(state.ops);
                }),
            ];
            return () => {
                for (const teardown of teardowns) teardown();
            };
        };

        return {
            ctx: {
                store: tokens.store,
                scaleState: scale.store,
                diffStore: diff.store,
            },
            activate: activateAll,
        };
    });

    useEffect(() => host.attach(ctx.store), [host, ctx.store]);

    useEffect(() => activate(), [activate]);

    return <StudioContext.Provider value={ctx}>{children}</StudioContext.Provider>;
}
