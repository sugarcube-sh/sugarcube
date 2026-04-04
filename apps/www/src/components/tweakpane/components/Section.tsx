import { type ReactNode, useState } from "react";

type SectionProps = {
    title: string;
    defaultExpanded?: boolean;
    children: ReactNode;
};

export function Section({ title, defaultExpanded = false, children }: SectionProps) {
    const [expanded, setExpanded] = useState(defaultExpanded);

    return (
        <section className="tweakpane-section" data-expanded={expanded}>
            <button
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
            {expanded && <div className="tweakpane-section-content">{children}</div>}
        </section>
    );
}
