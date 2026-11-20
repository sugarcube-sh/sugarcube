// Shows every kind of token value as text. TypeScript checks that every token type is handled, and
// knows the shape of each one's value.
import type { Token } from "@sugarcube-sh/dtcg";

export function describe(token: Token): string {
    switch (token.type) {
        case "color":
            return token.resolvedValue
                ? `${token.resolvedValue.colorSpace} ${token.resolvedValue.components.join(" ")}`
                : "";
        case "dimension":
            return token.resolvedValue
                ? `${token.resolvedValue.value}${token.resolvedValue.unit}`
                : "";
        case "duration":
            return token.resolvedValue
                ? `${token.resolvedValue.value}${token.resolvedValue.unit}`
                : "";
        case "cubicBezier":
            return token.resolvedValue?.join(", ") ?? "";
        case "number":
            return String(token.resolvedValue ?? "");
        case "fontFamily":
            return token.resolvedValue?.join(", ") ?? "";
        case "fontWeight":
            return String(token.resolvedValue ?? "");
        case "strokeStyle":
            return typeof token.resolvedValue === "string" ? token.resolvedValue : "dash";
        case "border":
            return token.resolvedValue ? `${token.resolvedValue.width.value}px` : "";
        case "shadow":
            return `${token.resolvedValue?.length ?? 0} layers`;
        case "gradient":
            return `${token.resolvedValue?.length ?? 0} stops`;
        case "transition":
            return token.resolvedValue ? `${token.resolvedValue.duration.value}ms` : "";
        case "typography":
            return token.resolvedValue?.fontFamily.join(", ") ?? "";
        default: {
            const unreachable: never = token;
            return unreachable;
        }
    }
}
