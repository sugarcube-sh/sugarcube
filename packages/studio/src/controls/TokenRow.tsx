import { Undo2Icon } from "lucide-react";
import type { ReactNode } from "react";
import { useHasPendingChange, useTokenStore } from "../store/hooks";

type Props = {
    path?: string;
    label: string;
    children: ReactNode;
};

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
            <Undo2Icon />
        </button>
    );
}
