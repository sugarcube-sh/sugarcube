import type { TypographyCSS } from "@sugarcube-sh/dtcg/css";
import type { TokenType } from "@sugarcube-sh/dtcg";

export function ValueText({ value, missing }: { value: unknown; missing?: string }) {
    if (value === undefined) return missing ?? null;
    return <code>{typeof value === "string" ? value : JSON.stringify(value)}</code>;
}

export function CSSValue({
    type,
    css,
}: {
    type: TokenType;
    css: string | TypographyCSS | undefined;
}) {
    if (css === undefined) return null;
    if (typeof css !== "string") {
        return (
            <dl>
                {Object.entries(css).map(([property, value]) => (
                    <div key={property}>
                        <dt>{property}</dt>
                        <dd>
                            <code>{value}</code>
                        </dd>
                    </div>
                ))}
            </dl>
        );
    }
    return (
        <>
            {type === "color" && (
                <span
                    aria-hidden="true"
                    style={{
                        display: "inline-block",
                        inlineSize: "1em",
                        blockSize: "1em",
                        background: css,
                    }}
                />
            )}{" "}
            <code>{css}</code>
        </>
    );
}
