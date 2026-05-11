import { type ReactNode, useEffect, useState } from "react";
import { createDevToolsHost } from "../host/devtools-host";
import { createEmbeddedHost } from "../host/embedded-host";
import { HostProvider } from "../host/host-provider";
import type { Host } from "../host/types";
import { TokenStoreProvider } from "./TokenStoreProvider";
import type { TokenSource } from "./token-source";

type Props = {
    source: TokenSource;
    children: ReactNode;
};

type HostState =
    | { kind: "loading" }
    | { kind: "error"; message: string }
    | { kind: "ready"; host: Host };

export function StudioProvider({ source, children }: Props) {
    const [state, setState] = useState<HostState>({ kind: "loading" });

    useEffect(() => {
        setState({ kind: "loading" });
        const controller = new AbortController();

        async function init() {
            try {
                const host =
                    source.mode === "devtools"
                        ? await createDevToolsHost(controller.signal)
                        : await createEmbeddedHost(controller.signal);

                if (!controller.signal.aborted) setState({ kind: "ready", host });
            } catch (err) {
                if (err instanceof DOMException && err.name === "AbortError") return;
                setState({
                    kind: "error",
                    message: err instanceof Error ? err.message : "Failed to connect",
                });
            }
        }

        init();
        return () => controller.abort();
    }, [source.mode]);

    if (state.kind === "error") {
        return (
            <div className="studio-error">
                <p>Failed to connect to the dev server.</p>
                <p>Make sure your Vite dev server is running and try reloading.</p>
                <details>
                    <summary>Details</summary>
                    <pre>{state.message}</pre>
                </details>
            </div>
        );
    }

    if (state.kind === "loading") {
        return (
            <div>{source.mode === "devtools" ? "Loading Studio..." : "Waiting for host..."}</div>
        );
    }

    return (
        <HostProvider host={state.host}>
            <TokenStoreProvider>{children}</TokenStoreProvider>
        </HostProvider>
    );
}
