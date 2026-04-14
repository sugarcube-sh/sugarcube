import type { ConvertedToken } from "@sugarcube-sh/core";
import { getCSSValue, isColorValue } from "../lib/token-value";

/** Compact preview for overview cards — shows swatches for colors, values for others */
export function TokenPreview({ tokens }: { tokens: ConvertedToken[] }) {
    const hasColors = tokens.some((t) => {
        const v = getCSSValue(t);
        return v && isColorValue(v);
    });

    if (hasColors) {
        return (
            <div>
                {tokens.map((t) => {
                    const v = getCSSValue(t);
                    if (!v || !isColorValue(v)) return null;
                    return <div key={t.$path} style={{ background: v }} title={t.$path} />;
                })}
            </div>
        );
    }

    return (
        <div>
            {tokens.map((t) => {
                const v = getCSSValue(t);
                return (
                    <span key={t.$path} title={t.$path}>
                        {v ?? t.$type}
                    </span>
                );
            })}
        </div>
    );
}
