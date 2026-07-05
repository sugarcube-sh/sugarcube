import { Tabs, TabsList, TabsPanel, TabsTrigger } from "../components/ui/tabs/tabs";
import { Header } from "./Header";
import { DesignArea } from "./areas/DesignArea";

export function Shell() {
    return (
        <div className="shell">
            <Header />

            <Tabs defaultValue="design">
                <TabsList aria-label="Studio sections" className="studio-tabs-list">
                    <TabsTrigger value="design" className="studio-tabs-trigger">
                        Design
                    </TabsTrigger>
                    <TabsTrigger value="tokens" className="studio-tabs-trigger">
                        Tokens
                    </TabsTrigger>
                    <TabsTrigger value="components" className="studio-tabs-trigger">
                        Components
                    </TabsTrigger>
                </TabsList>

                <TabsPanel value="design">
                    <DesignArea />
                </TabsPanel>
                <TabsPanel value="tokens">
                    <p>Coming soon</p>
                </TabsPanel>
                <TabsPanel value="components">
                    <p>Coming soon</p>
                </TabsPanel>
            </Tabs>
        </div>
    );
}

export function Icon({
    name,
    size = 12,
    className,
}: {
    name: string;
    size?: number;
    className?: string;
}) {
    const s = size;
    const common = {
        width: s,
        height: s,
        viewBox: "0 0 16 16",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 1.25,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        className,
    } as const;
    switch (name) {
        case "caret":
            return (
                <svg {...common}>
                    <path d="M4 6l4 4 4-4" />
                </svg>
            );
        case "chevron":
            return (
                <svg {...common}>
                    <path d="M6 4l4 4-4 4" />
                </svg>
            );
        case "search":
            return (
                <svg {...common}>
                    <circle cx="7" cy="7" r="4" />
                    <path d="M10 10l3 3" />
                </svg>
            );
        case "copy":
            return (
                <svg {...common}>
                    <rect x="5" y="5" width="8" height="8" rx="1" />
                    <path d="M3 11V4a1 1 0 0 1 1-1h7" />
                </svg>
            );
        case "reset":
            return (
                <svg {...common}>
                    <path d="M3 8a5 5 0 1 0 1.5-3.5" />
                    <path d="M3 3v2.5h2.5" />
                </svg>
            );
        case "link":
            return (
                <svg {...common}>
                    <path d="M7 9l2-2" />
                    <path d="M9 5l1-1a2.5 2.5 0 0 1 3.5 3.5l-1 1" />
                    <path d="M7 11l-1 1a2.5 2.5 0 0 1-3.5-3.5l1-1" />
                </svg>
            );
        case "sparkle":
            return (
                <svg {...common}>
                    <path d="M8 3l1 3 3 1-3 1-1 3-1-3-3-1 3-1z" />
                </svg>
            );
        case "more":
            return (
                <svg {...common}>
                    <circle cx="4" cy="8" r="0.8" fill="currentColor" stroke="none" />
                    <circle cx="8" cy="8" r="0.8" fill="currentColor" stroke="none" />
                    <circle cx="12" cy="8" r="0.8" fill="currentColor" stroke="none" />
                </svg>
            );
        case "undo":
            return (
                <svg {...common}>
                    <path d="M6 5L3 8l3 3" />
                    <path d="M3 8h7a3 3 0 0 1 0 6H8" />
                </svg>
            );
        case "redo":
            return (
                <svg {...common}>
                    <path d="M10 5l3 3-3 3" />
                    <path d="M13 8H6a3 3 0 0 0 0 6h2" />
                </svg>
            );
        case "eye":
            return (
                <svg {...common}>
                    <path d="M2 8s2-4 6-4 6 4 6 4-2 4-6 4-6-4-6-4z" />
                    <circle cx="8" cy="8" r="1.5" />
                </svg>
            );
        case "cog":
            return (
                <svg {...common}>
                    <circle cx="8" cy="8" r="2" />
                    <path d="M8 2v2M8 12v2M2 8h2M12 8h2M3.8 3.8l1.4 1.4M10.8 10.8l1.4 1.4M3.8 12.2l1.4-1.4M10.8 5.2l1.4-1.4" />
                </svg>
            );
        case "logo":
            return (
                <svg
                    width={s}
                    height={s}
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden="true"
                    focusable={false}
                >
                    <path
                        d="M8 1.5l5.5 3.2v6.6L8 14.5l-5.5-3.2V4.7L8 1.5z"
                        stroke="currentColor"
                        strokeWidth="1"
                    />
                    <path
                        d="M8 1.5v13M2.5 4.7l11 6.6M13.5 4.7l-11 6.6"
                        stroke="currentColor"
                        strokeWidth="0.75"
                        opacity="0.5"
                    />
                </svg>
            );
        case "palette":
            return (
                <svg {...common}>
                    <rect x="2" y="3" width="3" height="3" rx="0.5" />
                    <rect x="6.5" y="3" width="3" height="3" rx="0.5" />
                    <rect x="11" y="3" width="3" height="3" rx="0.5" />
                    <rect x="2" y="10" width="12" height="3" rx="0.5" />
                </svg>
            );
        case "token":
            return (
                <svg {...common}>
                    <circle cx="8" cy="8" r="5" />
                    <path d="M8 3v10M3 8h10" />
                </svg>
            );
        case "components":
            return (
                <svg {...common}>
                    <rect x="2" y="2" width="5" height="5" rx="0.5" />
                    <rect x="9" y="2" width="5" height="5" rx="0.5" />
                    <rect x="2" y="9" width="5" height="5" rx="0.5" />
                    <rect x="9" y="9" width="5" height="5" rx="0.5" />
                </svg>
            );
        default:
            return null;
    }
}
