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
        <section data-expanded={expanded}>
            <button
                ref={headerRef}
                type="button"
                onClick={() => setExpanded(!expanded)}
                aria-expanded={expanded}
            >
                <span>{title}</span>
                <span aria-hidden="true">{expanded ? "▼" : "▶"}</span>
            </button>
            {expanded && <div onKeyDown={handleContentKeyDown}>{children}</div>}
        </section>
    );
}
