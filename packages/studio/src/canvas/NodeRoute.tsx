import { tokenPath } from "@sugarcube-sh/dtcg";
import { useEffect, useMemo } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { hrefFor, pathFromPathname } from "../app/token-path";
import { nodeAt, sidebarTree } from "../controllers/views";
import { useStudio, useStudioState } from "../providers/studio-context";
import { GroupPage } from "./GroupPage";
import { TokenPage } from "./TokenPage";

export function useSelectedPath(): string | undefined {
    return pathFromPathname(useLocation().pathname);
}

export function NodeRoute() {
    const path = useSelectedPath();
    const tokens = useStudioState((state) => state.tokens);
    const showing = useStudioState((state) => state.showing);
    useFollowed(path);

    if (path === undefined) return <Home />;
    const found = nodeAt(tokens, showing, path);
    if (!found) return <p>Nothing at this address.</p>;
    if (found.node.kind === "group") {
        return <GroupPage key={path} group={found.node} shown={found.shown} />;
    }
    return <TokenPage key={path} token={found.node} shown={found.shown} />;
}

function useFollowed(path: string | undefined) {
    const studio = useStudio();
    const navigate = useNavigate();
    const id = useMemo(() => (path === undefined ? undefined : studio.idOf(path)), [studio, path]);
    const now = useStudioState(() => (id === undefined ? path : studio.pathOf(id)));

    useEffect(() => {
        if (path === undefined || now === path) return;
        const parent = tokenPath.parent(path);
        const to = now ?? parent;
        navigate(to === undefined ? "/" : hrefFor(to), { replace: true });
    }, [navigate, now, path]);
}

export function IndexRoute() {
    return <Home />;
}

function Home() {
    const tokens = useStudioState((state) => state.tokens);
    const first = useMemo(() => sidebarTree(tokens)[0], [tokens]);
    if (!first) return <p>This project has no tokens yet.</p>;
    return <Navigate to={hrefFor(first.path)} replace />;
}
