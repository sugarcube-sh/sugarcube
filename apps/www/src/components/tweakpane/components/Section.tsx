import { type KeyboardEvent, type ReactNode, useRef, useState } from "react";

type SectionProps = {
    title: string;
    defaultExpanded?: boolean;
    children: ReactNode;
};

export function Section({ title, defaultExpanded = false, children }: SectionProps) {
    const [expanded, setExpanded] = useState(defaultExpanded);
    const headerRef = useRef<HTMLButtonElement>(null);

    const handleContentKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
            e.stopPropagation();
            setExpanded(false);
            headerRef.current?.focus();
        }
    };

    return (
        <section className="tweakpane-section" data-expanded={expanded}>
            <button
                ref={headerRef}
                type="button"
                className="tweakpane-section-header"
                onClick={() => setExpanded(!expanded)}
                aria-expanded={expanded}
            >
                <span className="tweakpane-section-title">{title}</span>
                <span className="tweakpane-section-chevron" aria-hidden="true">
                    {expanded ? "▼" : "▶"}
                </span>
            </button>
            {expanded && (
                <div className="tweakpane-section-content" onKeyDown={handleContentKeyDown}>
                    {children}
                </div>
            )}
        </section>
    );
}
