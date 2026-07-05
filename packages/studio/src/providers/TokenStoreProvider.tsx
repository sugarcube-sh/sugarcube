import { type ReactNode, useEffect, useState } from "react";
import { useHost } from "../host/host-provider";
import { createDiffStore } from "../store/create-diff-store";
import { createTokenStore } from "../store/create-token-store";
import { StudioContext } from "../store/hooks";
import { createScaleState } from "../store/scale-state";

export function TokenStoreProvider({ children }: { children: ReactNode }) {
    const host = useHost();

    const [{ ctx, activate }] = useState(() => {
        const initialSnapshot = host.baseline.getState();
        const tokens = createTokenStore(host);
        const panel = initialSnapshot.config.studio?.panel ?? [];
        const scale = createScaleState(
            panel,
            initialSnapshot,
            tokens.getPathIndex,
            tokens.store,
            host.baseline,
            tokens.writeResolved,
        );
        const diff = createDiffStore(host, tokens.store, scale.store, tokens.getPathIndex);

        const activate = (): (() => void) => {
            const teardowns = [tokens.activate(), scale.activate(), diff.activate()];
            return () => {
                for (const teardown of teardowns) teardown();
            };
        };

        return {
            ctx: {
                store: tokens.store,
                getPathIndex: tokens.getPathIndex,
                scaleState: scale.store,
                diffStore: diff.store,
            },
            activate,
        };
    });

    useEffect(() => host.attach?.(ctx.store), [host, ctx.store]);

    useEffect(() => activate(), [activate]);

    return <StudioContext.Provider value={ctx}>{children}</StudioContext.Provider>;
}
