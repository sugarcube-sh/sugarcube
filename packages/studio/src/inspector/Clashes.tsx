import type { Clash } from "@sugarcube-sh/dtcg-edit";
import { useMemo } from "react";
import { useHeld } from "../canvas/use-held";
import { reasonsFor } from "../controllers/held";
import { type ClashRow, clashRows } from "../controllers/token-page";
import { useStudio, useStudioState } from "../providers/studio-context";

export function Clashes() {
    const studio = useStudio();
    const tokens = useStudioState((state) => state.tokens);
    const clashes = useStudioState((state) => state.clashes);
    const rows = useMemo(() => clashRows(tokens, clashes), [tokens, clashes]);
    const [why = [], holdWhy] = useHeld<readonly string[]>(clashes);
    if (rows.length === 0) return null;

    const keepYours = (clash: Clash) => {
        const done = studio.keep(clash, "yours");
        holdWhy(reasonsFor(done), studio.state.clashes);
    };

    return (
        <ul aria-label="Clashes">
            {rows.map((row) => (
                <li key={JSON.stringify(row.clash.step)}>
                    <Line row={row} />{" "}
                    {row.keepable && (
                        <>
                            <button type="button" onClick={() => keepYours(row.clash)}>
                                Keep yours
                            </button>{" "}
                        </>
                    )}
                    <button type="button" onClick={() => studio.keep(row.clash, "theirs")}>
                        Keep theirs
                    </button>
                </li>
            ))}
            {why.map((reason) => (
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
    const theme = row.label && ` (${row.label})`;
    if (row.kind === "removed") {
        return (
            <>
                You removed <code>{row.path}</code>. Changed elsewhere. Theirs:{" "}
                <Side value={row.theirs} />
            </>
        );
    }
    if (row.kind === "gone") {
        return (
            <>
                <code>{row.path}</code>
                {theme} removed or renamed elsewhere. Yours: <Side value={row.yours} />
            </>
        );
    }
    return (
        <>
            <code>{row.path}</code>
            {theme} changed elsewhere. Yours: <Side value={row.yours} /> Theirs:{" "}
            <Side value={row.theirs} />
        </>
    );
}

function Side({ value }: { value: unknown }) {
    if (value === undefined) return <>removed</>;
    return <code>{typeof value === "string" ? value : JSON.stringify(value)}</code>;
}
