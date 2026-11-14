import type { ColorComponent, ColorSpace } from "@sugarcube-sh/dtcg";

export interface RoundedColor {
    readonly colorSpace: ColorSpace;
    readonly components: readonly [ColorComponent, ColorComponent, ColorComponent];
    readonly alpha?: number;
    readonly hex?: string;
}

export function roundColor(color: {
    colorSpace: ColorSpace;
    components: readonly [Component, Component, Component];
    alpha?: number;
    hex?: string;
}): RoundedColor {
    const [a, b, c] = color.components;
    return {
        colorSpace: color.colorSpace,
        components: [roundComponent(a), roundComponent(b), roundComponent(c)],
        ...(color.alpha !== undefined && { alpha: roundToDecimals(color.alpha) }),
        ...(color.hex !== undefined && { hex: color.hex }),
    };
}

type Component = ColorComponent | undefined;

function roundComponent(component: Component): ColorComponent {
    return typeof component === "number" && !Number.isNaN(component)
        ? roundToDecimals(component)
        : "none";
}

const DECIMALS = 4;

function roundToDecimals(value: number): number {
    const factor = 10 ** DECIMALS;
    return (
        (Math.sign(value) * Math.round(Math.abs(value) * factor * (1 + 4 * Number.EPSILON))) /
        factor
    );
}
