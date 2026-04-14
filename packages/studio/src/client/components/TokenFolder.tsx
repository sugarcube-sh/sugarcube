import { type KeyboardEvent, type ReactNode, useRef } from "react";

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

    const handleContentKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
            e.stopPropagation();
            onToggle();
            headerRef.current?.focus();
        }
    };

    return (
        <div data-expanded={expanded}>
            <div>
                <button ref={headerRef} type="button" onClick={onToggle} aria-expanded={expanded}>
                    <span>{label}</span>
                    <span style={{ backgroundColor: `var(${cssVar})` }} />
                </button>
                {onReset && (
                    <button
                        type="button"
                        onClick={onReset}
                        disabled={!isCustom}
                        aria-label={`Reset ${label} to base palette`}
                        title="Reset to base"
                    >
                        ↺
                    </button>
                )}
                <button
                    type="button"
                    onClick={onToggle}
                    aria-expanded={expanded}
                    aria-label={`${expanded ? "Collapse" : "Expand"} ${label}`}
                >
                    <span aria-hidden="true">{expanded ? "▼" : "▶"}</span>
                </button>
            </div>
            {expanded && <div onKeyDown={handleContentKeyDown}>{children}</div>}
        </div>
    );
}
