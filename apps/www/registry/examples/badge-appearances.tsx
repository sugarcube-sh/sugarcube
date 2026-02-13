import { Badge } from "@/registry/components/badge/react/badge";

export function BadgeAppearances() {
    return (
        <div className="cluster gap-2xs">
            <Badge>Default</Badge>
            <Badge data-appearance="soft">Soft</Badge>
            <Badge data-appearance="outlined">Outlined</Badge>
        </div>
    );
}
