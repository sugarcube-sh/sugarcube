import { type ReactNode, useEffect, useState } from "react";
import type { TokenSnapshot } from "../../store/types";
import { useTokenStore } from "../store/hooks";
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
            <CSSBridge />
            {children}
        </TokenStoreProvider>
    );
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
