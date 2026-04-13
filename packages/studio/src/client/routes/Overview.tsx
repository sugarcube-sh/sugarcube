import { Link } from "react-router";
import { TokenPreview } from "../components/TokenPreview";
import { useStudio } from "../context";
import { collectTokens, countTokens } from "../lib/tree";

export function Overview() {
    const { status, error, tree } = useStudio();

    if (status === "connecting") {
        return <div className="page-status">Connecting to dev server…</div>;
    }

    if (status === "error") {
        return <div className="page-status page-status--error">Error: {error}</div>;
    }

    if (!tree) {
        return <div className="page-status">No tokens found.</div>;
    }

    return (
        <div className="overview">
            <h1 className="page-title">system overview</h1>

            <div className="overview-grid">
                {Array.from(tree.roots.values()).map((node) => (
                    <Link key={node.path} to={`/system/${node.path}`} className="overview-card">
                        <div className="overview-card-header">
                            <span className="overview-card-title">{node.name}</span>
                            <span className="overview-card-count">{countTokens(node)}</span>
                        </div>
                        {node.metadata?.$description && (
                            <p className="group-description">{node.metadata.$description}</p>
                        )}
                        <div className="overview-card-preview">
                            <TokenPreview tokens={collectTokens(node).slice(0, 8)} />
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}
