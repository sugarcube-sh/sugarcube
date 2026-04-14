export type ViewId = "edit" | "changes" | "tokens" | "scales";

type NavItem = {
    id: ViewId;
    label: string;
    icon: string;
    disabled?: boolean;
};

const NAV_ITEMS: NavItem[] = [
    { id: "edit", label: "Edit", icon: "✏️" },
    { id: "changes", label: "Changes", icon: "📝" },
    { id: "tokens", label: "Tokens", icon: "📋", disabled: true },
    { id: "scales", label: "Scales", icon: "📐", disabled: true },
];

type NavRailProps = {
    active: ViewId;
    onChange: (id: ViewId) => void;
};

export function NavRail({ active, onChange }: NavRailProps) {
    return (
        <nav aria-label="Studio navigation">
            {NAV_ITEMS.map((item) => (
                <button
                    key={item.id}
                    type="button"
                    data-active={active === item.id || undefined}
                    data-disabled={item.disabled || undefined}
                    disabled={item.disabled}
                    onClick={() => onChange(item.id)}
                    title={item.disabled ? `${item.label} (coming soon)` : item.label}
                    aria-current={active === item.id ? "page" : undefined}
                >
                    <span aria-hidden="true">{item.icon}</span>
                    <span>{item.label}</span>
                </button>
            ))}
        </nav>
    );
}
