import { type ReactNode, useEffect, useState } from "react";
import { createConnectedHost } from "../host/connected-host";
import { HostProvider } from "../host/host-provider";
import type { Host } from "../host/types";
import { TokenStoreProvider } from "./TokenStoreProvider";

type Props = {
    children: ReactNode;
};

type HostState =
    | { kind: "loading" }
    | { kind: "error"; message: string }
    | { kind: "ready"; host: Host };

/**
 * Studio is always a devframe client. Whether the other end is a live server
 * or a static dump is the transport's business, not a mode of the app.
 */
export function StudioProvider({ children }: Props) {
    const [state, setState] = useState<HostState>({ kind: "loading" });

    useEffect(() => {
        const controller = new AbortController();

        async function init() {
            try {
                const host = await createConnectedHost(controller.signal);
                if (!controller.signal.aborted) setState({ kind: "ready", host });
            } catch (err) {
                if (controller.signal.aborted) return;
                setState({
                    kind: "error",
                    message: err instanceof Error ? err.message : "Failed to connect",
                });
            }
        }

        init();
        return () => controller.abort();
    }, []);

    if (state.kind === "error") {
        return (
            <div className="studio-error">
                <p>Studio could not reach its host.</p>
                <p>Make sure the server that mounts Studio is running, then reload.</p>
                <pre>{state.message}</pre>
            </div>
        );
    }

    if (state.kind === "loading") {
        return (
            <div className="studio-loading">
                <div>Loading Studio...</div>
            </div>
        );
    }

    return (
        <HostProvider host={state.host}>
            <TokenStoreProvider>{children}</TokenStoreProvider>
        </HostProvider>
    );
}
