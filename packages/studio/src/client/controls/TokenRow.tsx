import type { ReactNode } from "react";
import { useHasPendingChange, useTokenStore } from "../store/hooks";

type Props = {
    /**
     * The token path this row edits. Used for Discard + pending-change detection.
     * Pass `undefined` for rows whose edit doesn't target a single token
     * (e.g. palette-swap rows, which affect many paths at once).
     */
    path?: string;
    /** Row label (left-aligned). */
    label: string;
    /** The control element (picker, slider, dropdown, etc.). */
    children: ReactNode;
};

/**
 * Shared row chrome for token bindings.
 *
 * Layout: [label] [control (flex)] [discard?]
 * Discard is hidden unless `path` is provided AND the token has a pending change.
 */
export function TokenRow({ path, label, children }: Props) {
    return (
        <div className="token-row">
            <span className="token-row-label">{label}</span>
            <div className="token-row-control">{children}</div>
            {path && <DiscardButton path={path} label={label} />}
        </div>
    );
}

function DiscardButton({ path, label }: { path: string; label: string }) {
    const hasChange = useHasPendingChange(path);
    const resetToken = useTokenStore((state) => state.resetToken);
    if (!hasChange) return null;
    return (
        <button
            type="button"
            className="token-row-discard"
            onClick={() => resetToken(path)}
            aria-label={`Discard change to ${label}`}
            title="Discard"
        >
            ↺
        </button>
    );
}
