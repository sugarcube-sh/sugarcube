import type { ConvertedToken } from "@sugarcube-sh/core";
import {
    getCSSValue,
    getTokenName,
    getTypographyProps,
    isColorValue,
    isTypographyToken,
} from "../lib/token-value";

export function TokenRow({ token }: { token: ConvertedToken }) {
    const name = getTokenName(token);
    const cssValue = getCSSValue(token);

    if (token.$type === "color" && cssValue && isColorValue(cssValue)) {
        return <ColorRow name={name} value={cssValue} token={token} />;
    }

    if (isTypographyToken(token)) {
        return <TypographyRow name={name} token={token} />;
    }

    if (token.$type === "dimension" && cssValue) {
        return <DimensionRow name={name} value={cssValue} token={token} />;
    }

    if (token.$type === "shadow" && cssValue) {
        return <ShadowRow name={name} value={cssValue} token={token} />;
    }

    if (token.$type === "border" && cssValue) {
        return <BorderRow name={name} value={cssValue} token={token} />;
    }

    if ((token.$type === "duration" || token.$type === "cubicBezier") && cssValue) {
        return <MotionRow name={name} value={cssValue} token={token} />;
    }

    // Fallback for any other type
    return (
        <div>
            <span>{name}</span>
            <span>{token.$type}</span>
            {cssValue && <span>{cssValue}</span>}
        </div>
    );
}

function ColorRow({
    name,
    value,
    token,
}: {
    name: string;
    value: string;
    token: ConvertedToken;
}) {
    return (
        <div>
            <div style={{ background: value }} />
            <span>{name}</span>
            {token.$description && <span>{token.$description}</span>}
            <span>{value}</span>
        </div>
    );
}

function DimensionRow({
    name,
    value,
    token,
}: {
    name: string;
    value: string;
    token: ConvertedToken;
}) {
    // Parse numeric value for the visual bar
    const num = Number.parseFloat(value);
    // Scale relative to a reasonable max (4rem = 64px)
    const pct = Number.isFinite(num) ? Math.min((num / 4) * 100, 100) : 0;

    return (
        <div>
            <span>{name}</span>
            <div>
                <div style={{ width: `${pct}%` }} />
            </div>
            {token.$description && <span>{token.$description}</span>}
            <span>{value}</span>
        </div>
    );
}

function TypographyRow({
    name,
    token,
}: {
    name: string;
    token: ConvertedToken;
}) {
    const typoProps = getTypographyProps(token);
    const cssValue = getCSSValue(token);

    return (
        <div>
            <span>{name}</span>
            {typoProps && <span style={typoProps}>Aa</span>}
            <span>{typoProps ? Object.values(typoProps).join(" / ") : (cssValue ?? "")}</span>
        </div>
    );
}

function ShadowRow({
    name,
    value,
    token,
}: {
    name: string;
    value: string;
    token: ConvertedToken;
}) {
    return (
        <div>
            <div style={{ boxShadow: value }} />
            <span>{name}</span>
            {token.$description && <span>{token.$description}</span>}
            <span>{value}</span>
        </div>
    );
}

function BorderRow({
    name,
    value,
    token,
}: {
    name: string;
    value: string;
    token: ConvertedToken;
}) {
    return (
        <div>
            <div style={{ borderBottom: value }} />
            <span>{name}</span>
            {token.$description && <span>{token.$description}</span>}
            <span>{value}</span>
        </div>
    );
}

function MotionRow({
    name,
    value,
    token,
}: {
    name: string;
    value: string;
    token: ConvertedToken;
}) {
    return (
        <div>
            <span>{name}</span>
            <span>{token.$type}</span>
            {token.$description && <span>{token.$description}</span>}
            <span>{value}</span>
        </div>
    );
}
