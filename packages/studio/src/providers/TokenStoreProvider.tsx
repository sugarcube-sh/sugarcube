import { type ReactNode, useEffect, useState } from "react";
import { useHost } from "../host/host-provider";
import { createTokenStore } from "../store/create-token-store";
import { StudioContext } from "../store/hooks";
import { createRecipeState } from "../store/recipe-state";
import { createScaleState } from "../store/scale-state";
import { sameKeySet } from "../tokens/same-key-set";
import { EmbeddedCSSBridge, EmbeddedPipelineRunner } from "./embedded-pipeline";

export function TokenStoreProvider({ children }: { children: ReactNode }) {
    const host = useHost();

    const [{ ctx, initialSnapshot }] = useState(() => {
        const initialSnapshot = host.baseline.getState();
        const { store, pathIndex, writeResolved } = createTokenStore(host);
        const panel = initialSnapshot.config.studio?.panel ?? [];
        const scaleState = createScaleState(
            panel,
            initialSnapshot,
            pathIndex,
            store,
            host.baseline,
            writeResolved
        );
        const recipeState = createRecipeState(
            panel,
            initialSnapshot,
            pathIndex,
            store,
            host.baseline,
            writeResolved
        );

        return {
            initialSnapshot,
            ctx: {
                store,
                pathIndex,
                scaleState,
                recipeState,
            },
        };
    });

    // When the host pushes a baseline whose key set has changed (e.g. an
    // externally-added or -removed token), refresh the PathIndex in place.
    // Mutation is deliberate: long-lived store-action closures hold this
    // reference and would otherwise be left pointing at a stale instance.
    useEffect(() => {
        return host.baseline.subscribe((nextSnapshot) => {
            if (sameKeySet(ctx.pathIndex.resolvedKeys(), Object.keys(nextSnapshot.resolved))) {
                return;
            }
            ctx.pathIndex.refresh(nextSnapshot.resolved);
        });
    }, [host.baseline, ctx.pathIndex]);

    return (
        <StudioContext.Provider value={ctx}>
            {!host.working && <EmbeddedPipelineRunner snapshot={initialSnapshot} />}
            {!host.working && <EmbeddedCSSBridge />}
            {children}
        </StudioContext.Provider>
    );
}
