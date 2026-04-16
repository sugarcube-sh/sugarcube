import { generateCSSVariables, processAndConvertTokens } from "@sugarcube-sh/core/client";
import { type ReactNode, useContext, useEffect, useRef, useState } from "react";
import type { TokenSnapshot } from "../../store/types";
import { StudioContext, useTokenStore } from "../store/hooks";
import { DevToolsTokenProvider } from "./DevToolsTokenProvider";
import { TokenStoreProvider } from "./TokenStoreProvider";
import type { TokenSource } from "./token-source";

// Re-export hooks that consumers use
export { useStudioConfig, useStudioMode } from "../store/hooks";

type Props = {
    source: TokenSource;
    children: ReactNode;
};

export function StudioProvider({ source, children }: Props) {
    if (source.mode === "devtools") {
        return <DevToolsTokenProvider>{children}</DevToolsTokenProvider>;
    }

    return <EmbeddedLoader>{children}</EmbeddedLoader>;
}

/**
 * Embedded mode: inside the <sugarcube-studio> web component iframe.
 * Receives snapshot via postMessage from the host page.
 * Sends CSS updates back via postMessage.
 */
function EmbeddedLoader({ children }: { children: ReactNode }) {
    const [snapshot, setSnapshot] = useState<TokenSnapshot | null>(null);

    useEffect(() => {
        function handleMessage(event: MessageEvent) {
            const data = event.data;
            if (!data || typeof data !== "object") return;
            if (data.type === "studio:init" && data.snapshot) {
                setSnapshot(data.snapshot as TokenSnapshot);
            }
        }

        window.addEventListener("message", handleMessage);
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
 * it to the host page via postMessage.
 */
function PipelineRunner({ snapshot }: { snapshot: TokenSnapshot }) {
    const ctx = useContext(StudioContext);
    const resolved = useTokenStore((state) => state.resolved);
    const runIdRef = useRef(0);

    useEffect(() => {
        if (!ctx) return;
        const { store } = ctx;
        const runId = ++runIdRef.current;
        let cancelled = false;

        store.setState({ isComputing: true });

        async function run() {
            try {
                const startedAt = performance.now();
                const converted = await processAndConvertTokens(
                    snapshot.trees,
                    resolved,
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
        return () => {
            cancelled = true;
        };
    }, [resolved, snapshot, ctx]);

    return null;
}

/**
 * Sends generated CSS to the host page via postMessage.
 * Only used in embedded mode.
 */
function CSSBridge() {
    const css = useTokenStore((state) => state.css);

    useEffect(() => {
        if (css !== null) {
            window.parent.postMessage({ type: "studio:css-update", css }, "*");
        }
    }, [css]);

    return null;
}
