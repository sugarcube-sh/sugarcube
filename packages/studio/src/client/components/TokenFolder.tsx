import { type KeyboardEvent, type ReactNode, useId, useRef } from "react";

type TokenFolderProps = {
    label: string;
    cssVar: string;
    expanded: boolean;
    onToggle: () => void;
    onReset?: () => void;
    isCustom?: boolean;
    children: ReactNode;
};

export function TokenFolder({
    label,
    cssVar,
    expanded,
    onToggle,
    onReset,
    isCustom = false,
    children,
}: TokenFolderProps) {
    const headerRef = useRef<HTMLButtonElement>(null);
    const panelId = useId();

    const handleContentKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
            e.stopPropagation();
            onToggle();
            headerRef.current?.focus();
        }
    };

    return (
        <div>
            <div>
                <button
                    ref={headerRef}
                    type="button"
                    onClick={onToggle}
                    aria-expanded={expanded}
                    aria-controls={panelId}
                >
                    <span aria-hidden="true" style={{ backgroundColor: `var(${cssVar})` }} />
                    <span>{label}</span>
                </button>
                {onReset && (
                    <button
                        type="button"
                        onClick={onReset}
                        disabled={!isCustom}
                        aria-label={`Discard custom value for ${label}`}
                    >
                        Discard
                    </button>
                )}
            </div>
            {expanded && (
                <div id={panelId} onKeyDown={handleContentKeyDown}>
                    {children}
                </div>
            )}
        </div>
    );
}
