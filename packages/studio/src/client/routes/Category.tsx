import { useParams } from "react-router";
import { TokenRow } from "../components/TokenRow";
import { useStudio } from "../context";
import { getCSSValue } from "../lib/token-value";
import { collectTokens, countTokens, getNodeByPath } from "../lib/tree";
import type { TokenTreeNode } from "../types";

export function Category() {
    const { "*": splatPath } = useParams();
    const { tree, contextInfos, baseContext, getTreeForContext } = useStudio();

    if (!splatPath || !tree) return null;

    const node = getNodeByPath(tree, splatPath);
    if (!node) {
        return <div className="page-status">No group found at "{splatPath}"</div>;
    }

    const totalCount = countTokens(node);

    // Override diffs
    const overrideSections: Array<{
        label: string;
        tokens: Array<{ token: any }>;
    }> = [];

    for (const ctxInfo of contextInfos) {
        if (ctxInfo.isBase) continue;
        const overrideTree = getTreeForContext(ctxInfo.key);
        if (!overrideTree) continue;
        const overrideNode = getNodeByPath(overrideTree, splatPath);
        if (!overrideNode) continue;

        const baseTokens = collectTokens(node);
        const baseValues = new Map(baseTokens.map((t) => [t.$path, getCSSValue(t)]));

        const changed = collectTokens(overrideNode).filter((t) => {
            const baseVal = baseValues.get(t.$path);
            return getCSSValue(t) !== baseVal;
        });

        if (changed.length > 0) {
            overrideSections.push({
                label: ctxInfo.label,
                tokens: changed.map((token) => ({ token })),
            });
        }
    }

    return (
        <div className="category-page">
            <h1 className="page-title">{node.name}</h1>
            {node.metadata?.$description && (
                <p className="group-description">{node.metadata.$description}</p>
            )}
            <p className="page-subtitle">
                {totalCount} token{totalCount !== 1 ? "s" : ""}
            </p>

            {/* Direct tokens at this level */}
            {node.tokens.length > 0 && (
                <div className="token-list">
                    {node.tokens.map((token) => (
                        <TokenRow key={token.$path} token={token} />
                    ))}
                </div>
            )}

            {/* Child subgroups rendered inline */}
            {Array.from(node.children.values()).map((child) => (
                <GroupSection key={child.path} node={child} />
            ))}

            {/* Override diffs */}
            {overrideSections.map((section) => (
                <section key={section.label} className="token-section token-section--context">
                    <h2 className="token-section-title">
                        {section.label} overrides
                        <span className="token-section-count">{section.tokens.length}</span>
                    </h2>
                    <div className="token-list">
                        {section.tokens.map(({ token }) => (
                            <TokenRow key={token.$path} token={token} />
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
}

function GroupSection({ node }: { node: TokenTreeNode }) {
    const count = countTokens(node);

    return (
        <section className="subgroup-section">
            <div className="subgroup-header">
                <span className="subgroup-name">{node.name}</span>
                <span className="subgroup-count">{count}</span>
            </div>
            {node.metadata?.$description && (
                <p className="group-description">{node.metadata.$description}</p>
            )}
            {node.tokens.length > 0 && (
                <div className="token-list">
                    {node.tokens.map((token) => (
                        <TokenRow key={token.$path} token={token} />
                    ))}
                </div>
            )}
            {Array.from(node.children.values()).map((child) => (
                <GroupSection key={child.path} node={child} />
            ))}
        </section>
    );
}
