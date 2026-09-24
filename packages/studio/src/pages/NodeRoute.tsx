import { Navigate, useParams } from "react-router";
import { isLeaf } from "../tokens/groups";
import { GroupPage } from "./GroupPage";
import { TokenPage } from "./TokenPage";
import { useNodeAt, useTokenTree } from "./use-groups";

export function useSelectedPath(): string | undefined {
    const params = useParams();
    const segments = [params.group, ...(params["*"]?.split("/") ?? [])].filter(Boolean);
    return segments.length > 0 ? segments.join(".") : undefined;
}

export function NodeRoute() {
    const path = useSelectedPath();
    const node = useNodeAt(path);
    const tree = useTokenTree();

    if (node) return isLeaf(node) ? <TokenPage node={node} /> : <GroupPage group={node} />;

    const first = tree[0];
    if (!first) return <NoTokens />;
    return <Navigate to={`/${first.name}`} replace />;
}

/** `/` has no fixed destination: it depends on what the document declares first. */
export function IndexRoute() {
    const tree = useTokenTree();
    const first = tree[0];
    if (!first) return <NoTokens />;
    return <Navigate to={`/${first.name}`} replace />;
}

function NoTokens() {
    return <p className="text-quiet">This project has no tokens yet.</p>;
}
