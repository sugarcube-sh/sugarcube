import { isReference } from "../guards/token-guards.js";
import type { CSSGradientProperties } from "../types/convert.js";
import type { TokenValue } from "../types/tokens.js";

export function convertGradientToken(value: TokenValue<"gradient">): CSSGradientProperties {
    if (isReference(value)) {
        return { value };
    }

    const stops = value.map((stop) => {
        const color = isReference(stop.color) ? stop.color : stop.color;
        const position = isReference(stop.position) ? stop.position : `${stop.position * 100}`;
        return `${color} ${position}%`;
    });

    return {
        value: `linear-gradient(${stops.join(", ")})`,
    };
}
