import type { Clash } from "@sugarcube-sh/dtcg-edit";
import { useMemo } from "react";
import { useKeyedState } from "../canvas/use-keyed-state";
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
                <ClashValue value={row.theirs} />
            </>
        );
    }
    if (row.kind === "gone") {
        return (
            <>
                <code>{row.path}</code>
                {permutationSuffix} removed or renamed elsewhere. Yours:{" "}
                <ClashValue value={row.yours} />
            </>
        );
    }
    return (
        <>
            <code>{row.path}</code>
            {permutationSuffix} changed elsewhere. Yours: <ClashValue value={row.yours} /> Theirs:{" "}
            <ClashValue value={row.theirs} />
        </>
    );
}

function ClashValue({ value }: { value: unknown }) {
    if (value === undefined) return <>removed</>;
    return <code>{typeof value === "string" ? value : JSON.stringify(value)}</code>;
}
