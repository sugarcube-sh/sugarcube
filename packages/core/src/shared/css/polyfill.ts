import type { ColorSpace, Part, Reference, Token } from "@sugarcube-sh/dtcg";

interface Fallbacks {
    spaces: ColorSpace[];
    missing: { token: Token; colorSpace: ColorSpace }[];
}

export function findFallbacks(from: Token, isPrivate: (each: Token) => boolean): Fallbacks {
    const found: Fallbacks = { spaces: [], missing: [] };
    const seen = new Set<Token>();
    const walk = (each: Token) => {
        if (seen.has(each)) return;
        seen.add(each);
        const parts = each.parts;
        if (parts) visit(each, parts);
    };
    const followReference = (ref: Reference | undefined): boolean => {
        const target = ref?.pointsToWholeToken;
        if (target && isPrivate(target)) walk(target);
        return target !== undefined;
    };
    const visit = (owner: Token, part: Part): void => {
        if (followReference(part.ref)) return;
        switch (part.type) {
            case "color": {
                const { colorSpace, hex } = part.resolved;
                if (colorSpace === "srgb" || colorSpace === "hsl") return;
                if (!found.spaces.includes(colorSpace)) found.spaces.push(colorSpace);
                if (hex === undefined) found.missing.push({ token: owner, colorSpace });
                return;
            }
            case "border":
                return visit(owner, part.color);
            case "shadow":
                for (const layer of part.layers) {
                    if (!followReference(layer.ref)) visit(owner, layer.color);
                }
                return;
            case "gradient":
                for (const stop of part.stops) visit(owner, stop.color);
                return;
            default:
                return;
        }
    };
    walk(from);
    return found;
}

export function toSupportsCondition(spaces: ColorSpace[]): string {
    return spaces.map((space) => `(color: ${getSampleColor(space)})`).join(" and ");
}

function getSampleColor(space: ColorSpace): string {
    switch (space) {
        case "lab":
        case "lch":
        case "oklab":
        case "oklch":
            return `${space}(0 0 0)`;
        case "hwb":
            return "hwb(0 0% 0%)";
        default:
            return `color(${space} 1 1 1)`;
    }
}
