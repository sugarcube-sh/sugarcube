import { tokenPath } from "@sugarcube-sh/dtcg";
import { useEffect, useMemo } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { toHref, toTokenPath } from "../app/token-path";
import { findTokenOrGroup, getSidebarTree } from "../controllers/views";
import { useStudio, useStudioState } from "../providers/studio-context";
import { GroupPage } from "./GroupPage";
import { TokenPage } from "./TokenPage";

export function useSelectedPath(): string | undefined {
    return toTokenPath(useLocation().pathname);
}

export function NodeRoute() {
    const path = useSelectedPath();
    const tokens = useStudioState((state) => state.tokens);
    const showing = useStudioState((state) => state.shownPermutation);
    useFollowNode(path);

    if (path === undefined) return <Home />;
    const selected = findTokenOrGroup(tokens, showing, path);
    if (!selected) return <p>Nothing at this address.</p>;
    if (selected.node.kind === "group") {
        return <GroupPage key={path} group={selected.node} isShown={selected.isShown} />;
    }
    return <TokenPage key={path} token={selected.node} isShown={selected.isShown} />;
}

function useFollowNode(path: string | undefined) {
    const studio = useStudio();
    const navigate = useNavigate();
    const id = useMemo(() => (path === undefined ? undefined : studio.getID(path)), [studio, path]);
    const currentPath = useStudioState(() => (id === undefined ? path : studio.getPath(id)));

    useEffect(() => {
        if (path === undefined || currentPath === path) return;
        const parent = tokenPath.getParent(path);
        const nextPath = currentPath ?? parent;
        navigate(nextPath === undefined ? "/" : toHref(nextPath), { replace: true });
    }, [navigate, currentPath, path]);
}

export function IndexRoute() {
    return <Home />;
}

function Home() {
    const tokens = useStudioState((state) => state.tokens);
    const first = useMemo(() => getSidebarTree(tokens)[0], [tokens]);
    if (!first) return <p>This project has no tokens yet.</p>;
    return <Navigate to={toHref(first.path)} replace />;
}
