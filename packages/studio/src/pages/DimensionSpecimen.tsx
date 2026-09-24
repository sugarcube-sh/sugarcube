import type { ResolvedToken } from "@sugarcube-sh/core/client";
import { lengthOf } from "../tokens/dimension";
import { useReadValue } from "./use-read-value";
import type { Measure } from "../tokens/measures";

const SAMPLE = "The quick brown fox";

export function DimensionSpecimen({ token, measure }: { token: ResolvedToken; measure?: Measure }) {
    const read = useReadValue();
    const length = lengthOf(token, read);
    if (length === undefined) return null;

    if (measure === "font-size") {
        return (
            <span className="specimen-type" style={{ fontSize: length }}>
                {SAMPLE}
            </span>
        );
    }

    if (measure === "border-radius") {
        return (
            <span
                className="specimen-corner"
                style={{ borderStartStartRadius: length }}
                aria-hidden="true"
            />
        );
    }

    if (measure === "border-width") {
        return (
            <span
                className="specimen-line"
                style={{ borderBlockStartWidth: length }}
                aria-hidden="true"
            />
        );
    }

    return (
        <span className="dimension-bar" aria-hidden="true">
            <span className="dimension-bar-fill" style={{ inlineSize: length }} />
        </span>
    );
}
