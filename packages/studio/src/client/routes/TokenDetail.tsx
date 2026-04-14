import { useParams } from "react-router";
import { TokenRow } from "../components/TokenRow";
import { useStudio } from "../context";
import { getCSSValue, getTokenName } from "../lib/token-value";
import { collectTokens } from "../lib/tree";

export function TokenDetail() {
    const { "*": tokenPath } = useParams();
    const { tree } = useStudio();

    if (!tokenPath || !tree) return null;

    // Find the token by searching all tokens in the tree
    let found = null;
    for (const root of tree.roots.values()) {
        const all = collectTokens(root);
        found = all.find((t) => t.$path === tokenPath) ?? null;
        if (found) break;
    }

    if (!found) {
        return <div>No token found at "{tokenPath}"</div>;
    }

    const cssValue = getCSSValue(found);

    return (
        <div>
            <h1>{getTokenName(found)}</h1>
            {found.$description && <p>{found.$description}</p>}
            <p>{found.$path}</p>

            <div>
                <TokenRow token={found} />
            </div>

            <dl>
                <dt>type</dt>
                <dd>{found.$type}</dd>
                <dt>path</dt>
                <dd>{found.$path}</dd>
                {cssValue && (
                    <>
                        <dt>css value</dt>
                        <dd>{cssValue}</dd>
                    </>
                )}
                {found.$source?.sourcePath && (
                    <>
                        <dt>source</dt>
                        <dd>{found.$source.sourcePath}</dd>
                    </>
                )}
            </dl>
        </div>
    );
}
