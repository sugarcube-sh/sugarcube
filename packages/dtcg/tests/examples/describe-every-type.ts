// Shows every kind of token value as text. TypeScript checks that every token type is handled, and
// knows the shape of each one's value.
import type { Token } from "@sugarcube-sh/dtcg";

export function describe(token: Token): string {
    switch (token.type) {
        case "color":
            return token.resolved
                ? `${token.resolved.colorSpace} ${token.resolved.components.join(" ")}`
                : "";
        case "dimension":
            return token.resolved ? `${token.resolved.value}${token.resolved.unit}` : "";
        case "duration":
            return token.resolved ? `${token.resolved.value}${token.resolved.unit}` : "";
        case "cubicBezier":
            return token.resolved?.join(", ") ?? "";
        case "number":
            return String(token.resolved ?? "");
        case "fontFamily":
            return token.resolved?.join(", ") ?? "";
        case "fontWeight":
            return String(token.resolved ?? "");
        case "strokeStyle":
            return token.resolved?.kind === "keyword" ? token.resolved.keyword : "dash";
        case "border":
            return token.resolved ? `${token.resolved.width.value}px` : "";
        case "shadow":
            return `${token.resolved?.length ?? 0} layers`;
        case "gradient":
            return `${token.resolved?.length ?? 0} stops`;
        case "transition":
            return token.resolved ? `${token.resolved.duration.value}ms` : "";
        case "typography":
            return token.resolved?.fontFamily.join(", ") ?? "";
        default: {
            const unreachable: never = token;
            return unreachable;
        }
    }
}
