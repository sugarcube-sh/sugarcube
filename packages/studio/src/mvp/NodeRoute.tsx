import { Navigate, useLocation } from "react-router";
import { hrefFor, pathFromPathname } from "../app/token-path";
import { usePathIndex } from "../store/hooks";
import type { PathIndex } from "../tokens/path-index";
import { GroupPage } from "./GroupPage";
import { TokenPage } from "./TokenPage";
import { firstGroupPath } from "./group-view";

export function useSelectedPath(): string | undefined {
    return pathFromPathname(useLocation().pathname);
}

export function NodeRoute() {
    const index = usePathIndex();
    const path = useSelectedPath();
    const handle = path === undefined ? undefined : index.handleAt(path);

    if (handle === undefined) return <Home index={index} />;
    return index.isGroup(handle) ? <GroupPage handle={handle} /> : <TokenPage handle={handle} />;
}

export function IndexRoute() {
    return <Home index={usePathIndex()} />;
}

function Home({ index }: { index: PathIndex }) {
    const first = firstGroupPath(index);
    if (!first) return <p>This project has no token groups yet.</p>;
    return <Navigate to={hrefFor(first)} replace />;
}
