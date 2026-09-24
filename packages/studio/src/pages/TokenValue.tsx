import type { ResolvedToken } from "@sugarcube-sh/core/client";
import { isDimension } from "../tokens/dimension";
import { resolveTerminalPath } from "../tokens/paths";
import { useReadValue } from "./use-read-value";
import { useTokenColor } from "./use-token-color";

export function TokenValue({ token }: { token: ResolvedToken }) {
    const css = useTokenColor(token.$path);
    const read = useReadValue();
    const raw = read(resolveTerminalPath(token.$path, read));
    const alias = typeof token.$value === "string" ? token.$value : undefined;

    switch (token.$type) {
        case "color": {
            const hex = css;
            return (
                <span className="cluster cluster-gap-100" data-cluster-wrap="nowrap">
                    <span className="token-swatch" style={{ background: hex }} aria-hidden="true" />
                    <code className="token-literal">{alias ?? hex}</code>
                    {alias && <code className="token-literal text-quiet">{hex}</code>}
                </span>
            );
        }

        case "dimension":
        case "duration": {
            if (!isDimension(raw)) break;
            return (
                <code className="token-literal">
                    {raw.value}
                    {raw.unit}
                </code>
            );
        }

        case "fontFamily":
            return (
                <code className="token-literal">
                    {Array.isArray(raw) ? raw.join(", ") : String(raw)}
                </code>
            );

        case "cubicBezier":
            return (
                <code className="token-literal">
                    cubic-bezier({Array.isArray(raw) ? raw.join(", ") : String(raw)})
                </code>
            );

        case "number":
            return <code className="token-literal">{String(raw)}</code>;
    }

    // An unhandled $type still shows something true rather than nothing.
    return <code className="token-literal text-quiet">{JSON.stringify(raw)}</code>;
}
