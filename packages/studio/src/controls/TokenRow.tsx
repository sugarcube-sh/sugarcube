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
            <span className="whitespace-nowrap">{label}</span>
            <div className="min-w-0">{children}</div>
            {path && <DiscardButton path={path} label={label} />}
        </div>
    );
}

function DiscardButton({ path, label }: { path: string; label: string }) {
    const hasChange = useHasPendingChange(path);
    const resetToken = useTokenStore((state) => state.resetToken);

    return (
        <button
            type="button"
            className="button"
            data-appearance="ghost"
            data-size="xs"
            style={hasChange ? undefined : { visibility: "hidden" }}
            aria-hidden={hasChange ? undefined : true}
            tabIndex={hasChange ? undefined : -1}
            disabled={!hasChange}
            onClick={() => resetToken(path)}
            aria-label={`Discard change to ${label}`}
            title="Discard"
        >
            <Undo2Icon />
        </button>
    );
}
