import { useCurrentContext, usePathIndex, useTokenStore } from "../store/hooks";
import { cssColorFor } from "../tokens/color-value";
import { unwrapRef } from "../tokens/paths";
import { type ReadValue, valueText } from "../tokens/value-text";

export function TokenSummary({ path }: { path: string }) {
    const pathIndex = usePathIndex();
    const resolved = useTokenStore((state) => state.resolved);
    const context = useCurrentContext();

    const token = pathIndex.readToken(resolved, path, context);
    if (!token) return null;

    const read: ReadValue = (p) => pathIndex.readValue(resolved, p, context);
    const reference = unwrapRef(token.$value);
    const css = token.$type === "color" ? cssColorFor(path, read) : undefined;
    const value = valueText(token.$type, path, read);

    return (
        <p className="token-summary cluster cluster-gap-150" data-cluster-wrap="nowrap">
            {reference && (
                <span className="cluster cluster-gap-100" data-cluster-wrap="nowrap">
                    {css && (
                        <span
                            className="token-swatch"
                            style={{ background: css }}
                            aria-hidden="true"
                        />
                    )}
                    <code className="token-summary-ref">{`{${reference}}`}</code>
                </span>
            )}
            {value && <code className="token-summary-value">{value}</code>}
        </p>
    );
}
