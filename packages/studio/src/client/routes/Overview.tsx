import { Link } from "react-router";
import { TokenPreview } from "../components/TokenPreview";
import { useStudio } from "../context";
import { collectTokens, countTokens } from "../lib/tree";

export function Overview() {
    const { status, error, tree } = useStudio();

    if (status === "connecting") {
        return <div>Connecting to dev server…</div>;
    }

    if (status === "error") {
        return <div>Error: {error}</div>;
    }

    if (!tree) {
        return <div>No tokens found.</div>;
    }

    return (
        <div>
            <h1>system overview</h1>

            <div>
                {Array.from(tree.roots.values()).map((node) => (
                    <Link key={node.path} to={`/system/${node.path}`}>
                        <div>
                            <span>{node.name}</span>
                            <span>{countTokens(node)}</span>
                        </div>
                        {node.metadata?.$description && <p>{node.metadata.$description}</p>}
                        <div>
                            <TokenPreview tokens={collectTokens(node).slice(0, 8)} />
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}
