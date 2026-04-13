import { getDevToolsRpcClient } from "@vitejs/devtools-kit/client";
import { type ReactNode, createContext, useContext, useEffect, useMemo, useState } from "react";
import { buildContextInfo, buildTokenTree } from "./lib/tree";
import type { ContextInfo, TokenData, TokenTree } from "./types";

type Status = "connecting" | "connected" | "error";

interface StudioContext {
    status: Status;
    error: string | null;
    data: TokenData | null;
    /** Token tree from the base context */
    tree: TokenTree | null;
    /** Derived context info with labels and base flag */
    contextInfos: ContextInfo[];
    /** The base context info */
    baseContext: ContextInfo | null;
    /** Build a tree for a specific context key */
    getTreeForContext: (ctxKey: string) => TokenTree | null;
}

const Ctx = createContext<StudioContext | null>(null);

export function StudioProvider({ children }: { children: ReactNode }) {
    const [status, setStatus] = useState<Status>("connecting");
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<TokenData | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const rpc = await getDevToolsRpcClient();
                if (cancelled) return;
                const callRpc = rpc.call as (method: string) => Promise<unknown>;
                const result = (await callRpc("studio:get-tokens")) as TokenData;
                if (cancelled) return;
                setData(result);
                setStatus("connected");
            } catch (err) {
                if (cancelled) return;
                setError((err as Error).message);
                setStatus("error");
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const contextInfos = useMemo(() => {
        if (!data?.tokens) return [];
        return buildContextInfo(Object.keys(data.tokens), data.permutations ?? []);
    }, [data]);

    const baseContext = contextInfos.find((c) => c.isBase) ?? contextInfos[0] ?? null;

    const tree = useMemo(() => {
        if (!data?.tokens || !baseContext) return null;
        const tokens = data.tokens[baseContext.key];
        return tokens ? buildTokenTree(baseContext.key, tokens) : null;
    }, [data, baseContext]);

    const getTreeForContext = (ctxKey: string): TokenTree | null => {
        const tokens = data?.tokens?.[ctxKey];
        return tokens ? buildTokenTree(ctxKey, tokens) : null;
    };

    return (
        <Ctx.Provider
            value={{
                status,
                error,
                data,
                tree,
                contextInfos,
                baseContext,
                getTreeForContext,
            }}
        >
            {children}
        </Ctx.Provider>
    );
}

export function useStudio(): StudioContext {
    const ctx = useContext(Ctx);
    if (!ctx) throw new Error("useStudio must be used within StudioProvider");
    return ctx;
}
