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
        return <div>No group found at "{splatPath}"</div>;
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
        <div>
            <h1>{node.name}</h1>
            {node.metadata?.$description && <p>{node.metadata.$description}</p>}
            <p>
                {totalCount} token{totalCount !== 1 ? "s" : ""}
            </p>

            {/* Direct tokens at this level */}
            {node.tokens.length > 0 && (
                <div>
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
                <section key={section.label}>
                    <h2>
                        {section.label} overrides
                        <span>{section.tokens.length}</span>
                    </h2>
                    <div>
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
        <section>
            <div>
                <span>{node.name}</span>
                <span>{count}</span>
            </div>
            {node.metadata?.$description && <p>{node.metadata.$description}</p>}
            {node.tokens.length > 0 && (
                <div>
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
