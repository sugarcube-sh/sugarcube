export function hexAsObject(hex: string): string {
    const digits = hex.slice(1);
    const full = digits.length <= 4 ? [...digits].map((digit) => digit + digit).join("") : digits;
    const channel = (at: number) => Number.parseInt(full.slice(at, at + 2), 16) / 255;
    const components = [0, 2, 4].map((at) => rounded(channel(at)));
    const alpha = full.length === 8 ? rounded(channel(6)) : undefined;
    return [
        "{ ",
        `"colorSpace": "srgb", "components": [${components.join(", ")}]`,
        alpha === undefined ? "" : `, "alpha": ${alpha}`,
        `, "hex": ${JSON.stringify(`#${full.slice(0, 6)}`)}`,
        " }",
    ].join("");
}

function rounded(value: number): number {
    return Math.round(value * 10_000) / 10_000;
}
