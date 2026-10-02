import type { ColorComponent, ColorValue, DimensionValue, Token } from "@sugarcube-sh/dtcg";

export function renderResolved(token: Token): string | undefined {
    switch (token.type) {
        case "color":
            return token.resolved && renderColor(token.resolved);
        case "dimension":
            return token.resolved && renderDimension(token.resolved);
        default:
            return undefined;
    }
}

function renderColor({ colorSpace, components, alpha, hex }: ColorValue): string | undefined {
    const [a, b, c] = components;
    switch (colorSpace) {
        case "srgb":
            if (hex !== undefined) return hexOf(hex, alpha);
            return withAlpha(`rgb(${[a, b, c].map(channel).join(" ")}`, alpha);
        case "hsl":
            return withAlpha(`hsl(${fixed(a, 1)} ${percent(b)} ${percent(c)}`, alpha);
        case "oklch":
            return withAlpha(`oklch(${[a, b, c].map((each) => fixed(each, 4)).join(" ")}`, alpha);
        case "display-p3":
            return withAlpha(
                `color(display-p3 ${[a, b, c].map((each) => fixed(each, 4)).join(" ")}`,
                alpha,
            );
        default:
            return undefined;
    }
}

function withAlpha(opened: string, alpha: number): string {
    return alpha === 1 ? `${opened})` : `${opened} / ${fixed(alpha, 4)})`;
}

function channel(component: ColorComponent): string {
    return component === "none" ? "none" : String(Math.round(component * 255));
}

function percent(component: ColorComponent): string {
    return component === "none" ? "none" : `${Math.round(component)}%`;
}

function fixed(component: ColorComponent, digits: number): string {
    return component === "none" ? "none" : String(Number(component.toFixed(digits)));
}

function hexOf(hex: string, alpha: number): string {
    if (alpha === 1) return hex;
    const pair = Math.round(alpha * 255)
        .toString(16)
        .padStart(2, "0");
    return `${hex}${/[A-F]/.test(hex) && !/[a-f]/.test(hex) ? pair.toUpperCase() : pair}`;
}

function renderDimension({ value, unit }: DimensionValue): string {
    return `${value}${unit}`;
}
