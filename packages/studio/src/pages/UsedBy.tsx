import type { ResolvedToken } from "@sugarcube-sh/core/client";
import { useMemo } from "react";
import { NavLink } from "react-router";
import { hrefFor } from "../app/token-path";
import { useCurrentContext, usePathIndex, useTokenStore } from "../store/hooks";
import { dependentPaths } from "../tokens/dependents";
import { unwrapRef } from "../tokens/paths";
import { TokenRows } from "./TokenRows";

export function UsedBy({ path }: { path: string }) {
    const pathIndex = usePathIndex();
    const resolved = useTokenStore((state) => state.resolved);
    const context = useCurrentContext();

    const tokens = useMemo(() => {
        const read = (p: string, ctx?: string) => pathIndex.readValue(resolved, p, ctx);
        return dependentPaths(path, read, pathIndex, context)
            .map((dependent) => pathIndex.readToken(resolved, dependent, context))
            .filter((token): token is ResolvedToken => token !== undefined);
    }, [path, pathIndex, resolved, context]);

    if (tokens.length === 0) return null;

    // Every dependent pointing at the same token makes the reference and value
    // columns a restatement of the page, so only the names are worth showing.
    const alike = new Set(tokens.map((token) => unwrapRef(token.$value))).size === 1;

    return (
        <section className="region region-space-800 flow">
            <h2 className="group-section-title">Used by</h2>
            {alike ? (
                <ul className="token-badges cluster cluster-gap-100">
                    {tokens.map((token) => (
                        <li key={token.$path}>
                            <NavLink className="token-badge" to={hrefFor(token.$path)} end>
                                {token.$path}
                            </NavLink>
                        </li>
                    ))}
                </ul>
            ) : (
                <TokenRows tokens={tokens} />
            )}
        </section>
    );
}
