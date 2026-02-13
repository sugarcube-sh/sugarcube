import { Badge } from "@/registry/components/badge/react/badge";

export function BadgeShapes() {
    return (
        <div className="cluster gap-2xs">
            <Badge>Default</Badge>
            <Badge data-shape="rounded">Rounded</Badge>
            <Badge data-shape="square">Square</Badge>
        </div>
    );
}
