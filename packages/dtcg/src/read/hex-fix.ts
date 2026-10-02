import { hexStringColor } from "../values/hex-color.js";

export function hexAsObject(hex: string): string {
    const { components, alpha, hex: kept } = hexStringColor(hex);
    const withAlpha = hex.length === 5 || hex.length === 9;
    return [
        "{ ",
        `"colorSpace": "srgb", "components": [${components.join(", ")}]`,
        withAlpha ? `, "alpha": ${alpha}` : "",
        `, "hex": ${JSON.stringify(kept)}`,
        " }",
    ].join("");
}
