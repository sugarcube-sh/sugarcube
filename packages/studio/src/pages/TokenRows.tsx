import type { ResolvedToken } from "@sugarcube-sh/core/client";
import { NavLink } from "react-router";
import { hrefFor } from "../app/token-path";
import { useCurrentContext, usePathIndex, useTokenStore } from "../store/hooks";
import { cssColorFor } from "../tokens/color-value";
import { unwrapRef } from "../tokens/paths";
import { type ReadValue, valueText } from "../tokens/value-text";
import { DimensionSpecimen } from "./DimensionSpecimen";
import { useMeasure } from "./use-measure";

/** A table of tokens with their values. Shared by the group and token pages. */
export function TokenRows({ tokens }: { tokens: readonly ResolvedToken[] }) {
    const pathIndex = usePathIndex();
    const resolved = useTokenStore((state) => state.resolved);
    const context = useCurrentContext();
    const measure = useMeasure();
    const drawn = tokens.some((token) => token.$type === "dimension");

    const read: ReadValue = (path) => pathIndex.readValue(resolved, path, context);

    return (
        <div className="table-wrapper">
            <table className="value-table">
                <thead>
                    <tr>
                        <th scope="col">Token</th>
                        <th scope="col">Reference</th>
                        <th scope="col">Value</th>
                    </tr>
                </thead>
                <tbody>
                    {tokens.map((token) => {
                        const reference = unwrapRef(token.$value);
                        const css =
                            token.$type === "color" ? cssColorFor(token.$path, read) : undefined;

                        return (
                            <tr key={token.$path}>
                                <th scope="row">
                                    <NavLink className="token-path" to={hrefFor(token.$path)} end>
                                        {token.$path}
                                    </NavLink>
                                    {token.$description && (
                                        <p className="token-row-description">
                                            {token.$description}
                                        </p>
                                    )}
                                </th>
                                <td>
                                    {reference ? (
                                        <span
                                            className="cluster cluster-gap-100"
                                            data-cluster-wrap="nowrap"
                                        >
                                            {css && (
                                                <span
                                                    className="token-swatch"
                                                    style={{ background: css }}
                                                    aria-hidden="true"
                                                />
                                            )}
                                            <code className="value-table-ref">{`{${reference}}`}</code>
                                        </span>
                                    ) : (
                                        <span className="value-table-unset">—</span>
                                    )}
                                </td>
                                <td>
                                    <span
                                        className="cluster cluster-gap-100"
                                        data-cluster-wrap="nowrap"
                                    >
                                        {drawn && (
                                            <DimensionSpecimen
                                                token={token}
                                                measure={measure(token.$path)}
                                            />
                                        )}
                                        <code className="value-table-value">
                                            {valueText(token.$type, token.$path, read)}
                                        </code>
                                    </span>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
