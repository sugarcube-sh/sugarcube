import { assignCSSNames, generateCSSVariables, groupByContext } from "@sugarcube-sh/core/client";
import { useEffect, useRef } from "react";
import { useTokenStore, useTokenStoreApi } from "../store/hooks";
import type { TokenSnapshot } from "../tokens/types";

/**
 * Runs the sugarcube pipeline in-browser whenever resolved tokens change.
 * Writes the generated CSS to the store; CSSBridge picks it up and sends
 * it to the host page.
 *
 * Only mounted when there is no host working channel (i.e. Embedded mode).
 * In DevTools the server runs the pipeline and HMR delivers the CSS.
 */
export function EmbeddedPipelineRunner({ snapshot }: { snapshot: TokenSnapshot }) {
    const store = useTokenStoreApi();
    const resolved = useTokenStore((state) => state.resolved);
    const runIdRef = useRef(0);

    useEffect(
        function runPipeline() {
            let cancelled = false;

            // This is me trying to debounce/batch slider changes
            // into a single pipeline run instead of firing on every mousemove.
            // TODO: find a better way to do this.
            const frameId = requestAnimationFrame(() => {
                const runId = ++runIdRef.current;
                store.setState({ isComputing: true });

                async function run() {
                    try {
                        const startedAt = performance.now();
                        const converted = assignCSSNames(
                            groupByContext(snapshot.trees, resolved),
                            snapshot.config
                        );
                        const result = await generateCSSVariables(converted, snapshot.config);

                        if (cancelled || runId !== runIdRef.current) return;

                        const allCSS = result.map((file) => file.css).join("\n\n");
                        store.setState({
                            css: allCSS,
                            lastRunMs: performance.now() - startedAt,
                            error: null,
                            isComputing: false,
                        });
                    } catch (err) {
                        if (cancelled || runId !== runIdRef.current) return;
                        store.setState({
                            error: err instanceof Error ? err.message : String(err),
                            css: null,
                            isComputing: false,
                        });
                    }
                }

                run();
            });

            return () => {
                cancelled = true;
                cancelAnimationFrame(frameId);
            };
        },
        [resolved, snapshot, store]
    );

    return null;
}

export function EmbeddedCSSBridge() {
    const css = useTokenStore((state) => state.css);

    useEffect(
        function sendCSSToHost() {
            if (css !== null) {
                window.parent.postMessage({ type: "studio:css-update", css }, "*");
            }
        },
        [css]
    );

    return null;
}
