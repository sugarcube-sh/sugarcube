import type { ResolvedToken } from "@sugarcube-sh/core/client";
import { useMemo } from "react";
import { useCurrentContext, usePathIndex, useTokenStore } from "../store/hooks";
import { cssColorFor } from "../tokens/color-value";
import type { TokenNode } from "../tokens/groups";
import { TokenPath } from "../controls/TokenPath";
import { DimensionSpecimen } from "./DimensionSpecimen";
import { TokenSummary } from "./TokenSummary";
import { PageHeader, PagePending } from "./PageHeader";
import { TokenEditor } from "./TokenEditor";
import { TokenTitle } from "./TokenTitle";
import { UsedBy } from "./UsedBy";
import { useMeasure } from "./use-measure";

function Specimen({ token, css }: { token: ResolvedToken; css: string | undefined }) {
    const measure = useMeasure();

    if (token.$type === "color") {
        return <span className="specimen-color" style={{ background: css }} aria-hidden="true" />;
    }

    return <DimensionSpecimen token={token} measure={measure(token.$path)} />;
}

export function TokenPage({ node }: { node: TokenNode }) {
    const pathIndex = usePathIndex();
    const resolved = useTokenStore((state) => state.resolved);
    const context = useCurrentContext();

    const token = pathIndex.readToken(resolved, node.path, context);

    const cssFor = useMemo(
        () => (path: string) => cssColorFor(path, (p) => pathIndex.readValue(resolved, p, context)),
        [pathIndex, resolved, context],
    );

    if (!token) {
        return (
            <>
                <PageHeader title={<TokenPath path={node.path} className="page-title-path" />} />
                <PagePending>
                    This token is not defined in the <code>{context}</code> context.
                </PagePending>
            </>
        );
    }

    return (
        <>
            {/* <PageHeader
                title={<TokenPath path={node.path} className="page-title-path" />}
                identity={<CustomProperty path={node.path} />}
                description={<EditableDescription path={node.path} />}
            /> */}

            <section
                className="cluster"
                style={
                    {
                        "--cluster-vertical-alignment": "start",
                        "--cluster-gap": "var(--space-400)",
                    } as React.CSSProperties
                }
            >
                <Specimen token={token} css={cssFor(node.path)} />

                <TokenTitle path={node.path} />
                <TokenEditor token={token} />
            </section>

            <div className="region region-space-800">
                <TokenSummary path={node.path} />
            </div>

            {/* {inContext.length > 0 && (
                <section className="group-section flow">
                    <h2 className="group-section-title">
                        In context
                        <span className="group-section-note text-quiet"> — {parent}</span>
                    </h2>
                    {allColour ? (
                        <SwatchRun
                            run={{ name: "", tokens: inContext }}
                            columns={inContext.length}
                            cssFor={cssFor}
                            hrefFor={hrefFor}
                        />
                    ) : (
                        <TokenRows tokens={inContext} />
                    )}
                </section>
            )} */}

            <UsedBy path={node.path} />
        </>
    );
}
