/**
 * Top-level studio provider. Picks the right Host adapter for the launch
 * source (DevTools dock vs. embedded iframe), then wraps children in
 * HostProvider + the unified TokenStoreProvider. Renders error and
 * loading states while the host adapter initializes.
 */

import { type ReactNode, useEffect, useState } from "react";
import { createDevToolsHost } from "../host/devtools-host";
import { createEmbeddedHost } from "../host/embedded-host";
import { HostProvider } from "../host/host-provider";
import type { Host } from "../host/types";
import { TokenStoreProvider } from "./TokenStoreProvider";
import type { TokenSource } from "./token-source";

export { useStudioConfig } from "../store/hooks";

type Props = {
    source: TokenSource;
    children: ReactNode;
};

/**
 * Top-level Studio provider. Builds the appropriate Host adapter from
 * the launch source, then wraps children in HostProvider + the unified
 * TokenStoreProvider.
 */
export function StudioProvider({ source, children }: Props) {
    const [host, setHost] = useState<Host | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const controller = new AbortController();

        const promise =
            source.mode === "devtools"
                ? createDevToolsHost(controller.signal)
                : createEmbeddedHost(controller.signal);

        promise
            .then((h) => {
                if (!controller.signal.aborted) setHost(h);
            })
            .catch((err) => {
                if (err instanceof DOMException && err.name === "AbortError") return;
                setError(err instanceof Error ? err.message : "Failed to connect");
            });

        return () => controller.abort();
    }, [source.mode]);

    if (error) {
        return (
            <div className="studio-error">
                <p>Failed to connect to the dev server.</p>
                <p>Make sure your Vite dev server is running and try reloading.</p>
                <details>
                    <summary>Details</summary>
                    <pre>{error}</pre>
                </details>
            </div>
        );
    }

    if (!host) {
        return (
            <div>{source.mode === "devtools" ? "Loading Studio..." : "Waiting for host..."}</div>
        );
    }

    return (
        <HostProvider host={host}>
            <TokenStoreProvider>{children}</TokenStoreProvider>
        </HostProvider>
    );
}
