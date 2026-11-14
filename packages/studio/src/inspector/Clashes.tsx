import type { Clash } from "@sugarcube-sh/dtcg-edit";
import { useMemo } from "react";
import { useKeyedState } from "../canvas/use-keyed-state";
import { ValueText } from "../canvas/Value";
import { getReasons } from "../controllers/keyed-value";
import { type ClashRow, toClashRows } from "../controllers/token-page";
import { useStudio, useStudioState } from "../providers/studio-context";

export function Clashes() {
    const studio = useStudio();
    const tokens = useStudioState((state) => state.tokens);
    const clashes = useStudioState((state) => state.clashes);
    const rows = useMemo(() => toClashRows(tokens, clashes), [tokens, clashes]);
    const [reasons = [], setReasons] = useKeyedState<readonly string[]>(clashes);
    if (rows.length === 0) return null;

    const keepYours = (clash: Clash) => {
        const commitResult = studio.resolveClash(clash, "yours");
        setReasons(getReasons(commitResult), studio.state.clashes);
    };

    return (
        <ul aria-label="Clashes">
            {rows.map((row) => (
                <li key={JSON.stringify(row.clash.step)}>
                    <Line row={row} />{" "}
                    {row.canKeepYours && (
                        <>
                            <button type="button" onClick={() => keepYours(row.clash)}>
                                Keep yours
                            </button>{" "}
                        </>
                    )}
                    <button type="button" onClick={() => studio.resolveClash(row.clash, "theirs")}>
                        Keep theirs
                    </button>
                </li>
            ))}
            {reasons.map((reason) => (
                <li key={reason}>{reason}</li>
            ))}
        </ul>
    );
}

function Line({ row }: { row: ClashRow }) {
    if (row.kind === "renamed") {
        return (
            <>
                You renamed <code>{row.from}</code> to <code>{row.to}</code>. Removed or renamed
                elsewhere.
            </>
        );
    }
    const permutationSuffix = row.label && ` (${row.label})`;
    if (row.kind === "removed") {
        return (
            <>
                You removed <code>{row.path}</code>. Changed elsewhere. Theirs:{" "}
                <ValueText value={row.theirs} missing="removed" />
            </>
        );
    }
    if (row.kind === "gone") {
        return (
            <>
                <code>{row.path}</code>
                {permutationSuffix} removed or renamed elsewhere. Yours:{" "}
                <ValueText value={row.yours} missing="removed" />
            </>
        );
    }
    return (
        <>
            <code>{row.path}</code>
            {permutationSuffix} changed elsewhere. Yours:{" "}
            <ValueText value={row.yours} missing="removed" /> Theirs:{" "}
            <ValueText value={row.theirs} missing="removed" />
        </>
    );
}
