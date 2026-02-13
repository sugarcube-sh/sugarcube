import { isReference } from "../guards/token-guards.js";
import type { CSSTransitionProperties } from "../types/convert.js";
import type { Duration, TokenValue } from "../types/tokens.js";

function formatDuration(duration: Duration | undefined): string {
    if (!duration) return "0ms";
    return `${duration.value}${duration.unit}`;
}

export function convertTransitionToken(value: TokenValue<"transition">): CSSTransitionProperties {
    if (isReference(value)) {
        return { value };
    }

    const duration = isReference(value.duration) ? value.duration : formatDuration(value.duration);

    const timingFunction = isReference(value.timingFunction)
        ? value.timingFunction
        : `cubic-bezier(${value.timingFunction.join(", ")})`;

    const delay =
        value.delay && (isReference(value.delay) ? value.delay : formatDuration(value.delay));

    return {
        value: [duration, timingFunction, delay].filter(Boolean).join(" "),
    };
}
