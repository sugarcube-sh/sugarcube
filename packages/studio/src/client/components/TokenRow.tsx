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
        <div className="token-row">
            <span className="token-name">{name}</span>
            <span className="token-type">{token.$type}</span>
            {cssValue && <span className="token-value">{cssValue}</span>}
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
        <div className="token-row token-row--color">
            <div className="token-swatch" style={{ background: value }} />
            <span className="token-name">{name}</span>
            {token.$description && <span className="token-description">{token.$description}</span>}
            <span className="token-value">{value}</span>
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
        <div className="token-row token-row--dimension">
            <span className="token-name">{name}</span>
            <div className="token-bar-track">
                <div className="token-bar-fill" style={{ width: `${pct}%` }} />
            </div>
            {token.$description && <span className="token-description">{token.$description}</span>}
            <span className="token-value">{value}</span>
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
        <div className="token-row token-row--typography">
            <span className="token-name">{name}</span>
            {typoProps && (
                <span className="token-type-preview" style={typoProps}>
                    Aa
                </span>
            )}
            <span className="token-value">
                {typoProps ? Object.values(typoProps).join(" / ") : (cssValue ?? "")}
            </span>
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
        <div className="token-row token-row--shadow">
            <div className="token-shadow-preview" style={{ boxShadow: value }} />
            <span className="token-name">{name}</span>
            {token.$description && <span className="token-description">{token.$description}</span>}
            <span className="token-value">{value}</span>
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
        <div className="token-row token-row--border">
            <div className="token-border-preview" style={{ borderBottom: value }} />
            <span className="token-name">{name}</span>
            {token.$description && <span className="token-description">{token.$description}</span>}
            <span className="token-value">{value}</span>
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
        <div className="token-row token-row--motion">
            <span className="token-name">{name}</span>
            <span className="token-type">{token.$type}</span>
            {token.$description && <span className="token-description">{token.$description}</span>}
            <span className="token-value">{value}</span>
        </div>
    );
}
