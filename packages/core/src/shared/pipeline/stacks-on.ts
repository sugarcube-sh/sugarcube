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

// We need to determine whether the current at-rule's block sits *inside* the previous one,
// so its declarations are layered on top rather than replacing them.
//
// A `min-width: 640px` rule is still in effect at 1024px, so a `min-width: 1024px`
// block that follows it only needs to state what actually changes. Mutually
// exclusive at-rules (e.g. `prefers-color-scheme: light` and `dark`) do not stack:
// neither is in effect when the other is, so each must state its values in full.
//
// Only single-condition, open-ended `px`/`em`/`rem` width queries are recognised.
// Anything else is opaque and never stacks. Failing to recognise a query costs a
// redundant (but valid) block; wrongly recognising one would drop a needed
// declaration, so the patterns are deliberately strict.
//
// Widths are compared only within a single unit: in a media query `em`/`rem`
// resolve against the browser's initial font size, unknown at build time, so
// `40em` cannot be ordered against `640px`.
export function stacksOn(previous: string | undefined, current: string | undefined): boolean {
    const prev = classify(previous);
    const cur = classify(current);

    if (prev.kind === "other" || cur.kind === "other") return false;
    if (prev.kind === "none") return true;
    if (cur.kind === "none") return false;
    if (prev.kind !== cur.kind || prev.unit !== cur.unit) return false;

    return prev.kind === "min" ? cur.width > prev.width : cur.width < prev.width;
}
