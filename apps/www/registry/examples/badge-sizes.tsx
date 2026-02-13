import { Badge } from "@/registry/components/badge/react/badge";

export function BadgeSizes() {
    return (
        <div className="cluster gap-2xs">
            <Badge>Default</Badge>
            <Badge data-size="lg">Large</Badge>
        </div>
    );
}
