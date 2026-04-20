import { type ReactNode, useState } from "react";
import { createTokenStore } from "../store/create-token-store";
import { StudioContext } from "../store/hooks";
import { createScaleState } from "../store/scale-state";
import type { TokenSnapshot } from "../tokens/types";

type Props = {
    snapshot: TokenSnapshot;
    mode: "devtools" | "embedded";
    children: ReactNode;
};

export function TokenStoreProvider({ snapshot, mode, children }: Props) {
    const [ctx] = useState(() => {
        const { store, pathIndex } = createTokenStore(snapshot);
        const scaleState = createScaleState(
            snapshot.config.studio?.panel ?? [],
            snapshot,
            pathIndex,
            store
        );

        return {
            mode,
            store,
            pathIndex,
            snapshot,
            scaleState,
            studioConfig: snapshot.config.studio,
        };
    });

    return <StudioContext.Provider value={ctx}>{children}</StudioContext.Provider>;
}
