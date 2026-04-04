import type { ReactNode } from "react";

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
    return (
        <div className="tweakpane-folder" data-expanded={expanded}>
            <div className="tweakpane-folder-header-row">
                <button
                    type="button"
                    className="tweakpane-folder-header"
                    onClick={onToggle}
                    aria-expanded={expanded}
                >
                    <span className="tweakpane-folder-label">{label}</span>
                    <span
                        className="tweakpane-folder-swatch"
                        style={{ backgroundColor: `var(${cssVar})` }}
                    />
                </button>
                {onReset && (
                    <button
                        type="button"
                        className="tweakpane-folder-reset"
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
                    className="tweakpane-folder-toggle"
                    onClick={onToggle}
                    aria-expanded={expanded}
                    aria-label={`${expanded ? "Collapse" : "Expand"} ${label}`}
                >
                    <span className="tweakpane-folder-chevron" aria-hidden="true">
                        {expanded ? "▼" : "▶"}
                    </span>
                </button>
            </div>
            {expanded && <div className="tweakpane-folder-content">{children}</div>}
        </div>
    );
}
