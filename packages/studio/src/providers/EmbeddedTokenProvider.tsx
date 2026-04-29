import { assignCSSNames, generateCSSVariables, groupByContext } from "@sugarcube-sh/core/client";
import { type ReactNode, useContext, useEffect, useRef, useState } from "react";
import { StudioContext, useTokenStore } from "../store/hooks";
import type { TokenSnapshot } from "../tokens/types";
import { TokenStoreProvider } from "./TokenStoreProvider";

/**
 * Embedded mode provider: runs inside the <sugarcube-studio> web component iframe.
 *
 * Lifecycle:
 *   1. Sends "studio:ready" to the host page
 *   2. Receives a token snapshot via postMessage ("studio:init")
 *   3. Runs the sugarcube pipeline in-browser on every token change
 *   4. Sends generated CSS back to the host via postMessage ("studio:css-update")
 *
 * The browser owns the pipeline in this mode — there is no dev server.
 */
export function EmbeddedTokenProvider({ children }: { children: ReactNode }) {
    const [snapshot, setSnapshot] = useState<TokenSnapshot | null>(null);

    useEffect(function listenForHostSnapshot() {
        // No event.origin check — any parent can send the init snapshot.
        // Acceptable for a dev tool on localhost/staging. If Studio ever
        // supports production embedding, add origin validation here (e.g.
        // host passes its origin via the iframe URL, iframe checks against it).
        function handleMessage(event: MessageEvent) {
            const data = event.data;
            if (!data || typeof data !== "object") return;
            if (data.type === "studio:init" && isTokenSnapshot(data.snapshot)) {
                setSnapshot(data.snapshot);
            }
        }

        window.addEventListener("message", handleMessage);
        // "*" targetOrigin is intentional — Studio can be embedded on any
        // origin (localhost, staging, preview deploys). The messages contain
        // only CSS and token data, not credentials or user content.
        window.parent.postMessage({ type: "studio:ready" }, "*");

        return () => window.removeEventListener("message", handleMessage);
    }, []);

    if (!snapshot) {
        return <div>Waiting for host...</div>;
    }

    return (
        <TokenStoreProvider snapshot={snapshot} mode="embedded">
            <PipelineRunner snapshot={snapshot} />
            <CSSBridge />
            {children}
        </TokenStoreProvider>
    );
}

/**
 * Runs the sugarcube pipeline in-browser whenever resolved tokens change.
 * Writes the generated CSS to the store; CSSBridge picks it up and sends
 * it to the host page.
 */
function PipelineRunner({ snapshot }: { snapshot: TokenSnapshot }) {
    const ctx = useContext(StudioContext);
    const resolved = useTokenStore((state) => state.resolved);
    const runIdRef = useRef(0);

    useEffect(
        function runPipeline() {
            if (!ctx) return;
            const { store } = ctx;
            let cancelled = false;

            // Defer to next frame so rapid changes (e.g. slider drags) batch
            // into a single pipeline run instead of firing on every mousemove.
            // Better way to do this?
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
        [resolved, snapshot, ctx]
    );

    return null;
}

// This is how we send the generated CSS to the host page
function CSSBridge() {
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

function isTokenSnapshot(value: unknown): value is TokenSnapshot {
    if (!value || typeof value !== "object") return false;
    const obj = value as Record<string, unknown>;
    return "config" in obj && "trees" in obj && "resolved" in obj;
}
