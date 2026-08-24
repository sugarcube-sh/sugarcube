const MIN_WIDTH_RE = /^@media\s*\(\s*min-width\s*:\s*(\d+(?:\.\d+)?)(px|em|rem)\s*\)$/;
const MAX_WIDTH_RE = /^@media\s*\(\s*max-width\s*:\s*(\d+(?:\.\d+)?)(px|em|rem)\s*\)$/;
const RANGE_RE = /^@media\s*\(\s*width\s*(>=|>|<=|<)\s*(\d+(?:\.\d+)?)(px|em|rem)\s*\)$/;

type WidthQuery = { kind: "none" | "min" | "max" | "other"; width: number; unit: string };

function classify(atRule: string | undefined): WidthQuery {
    if (!atRule) return { kind: "none", width: 0, unit: "" };

    const trimmed = atRule.trim();
    const min = MIN_WIDTH_RE.exec(trimmed);
    if (min?.[1] && min[2]) return { kind: "min", width: Number(min[1]), unit: min[2] };

    const max = MAX_WIDTH_RE.exec(trimmed);
    if (max?.[1] && max[2]) return { kind: "max", width: Number(max[1]), unit: max[2] };

    const range = RANGE_RE.exec(trimmed);
    if (range?.[1] && range[2] && range[3]) {
        return {
            kind: range[1].startsWith(">") ? "min" : "max",
            width: Number(range[2]),
            unit: range[3],
        };
    }

    return { kind: "other", width: 0, unit: "" };
}

// When emitting CSS for successive media queries, ask: does `current` only match
// viewports that already match `previous`? (e.g. min-1024 after min-640.)
// If so, the previous values still apply and we only need to write what changed.
export function stacksOn(previous: string | undefined, current: string | undefined): boolean {
    const prev = classify(previous);
    const cur = classify(current);

    if (prev.kind === "other" || cur.kind === "other") return false;
    if (prev.kind === "none") return true;
    if (cur.kind === "none") return false;
    if (prev.kind !== cur.kind || prev.unit !== cur.unit) return false;

    return prev.kind === "min" ? cur.width > prev.width : cur.width < prev.width;
}
