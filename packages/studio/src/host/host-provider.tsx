import { type ReactNode, createContext, useContext } from "react";
import type { Host } from "./types";

const HostContext = createContext<Host | null>(null);

export function HostProvider({ host, children }: { host: Host; children: ReactNode }) {
    return <HostContext.Provider value={host}>{children}</HostContext.Provider>;
}

export function useHost(): Host {
    const host = useContext(HostContext);
    if (!host) throw new Error("useHost must be used inside a HostProvider");
    return host;
}
